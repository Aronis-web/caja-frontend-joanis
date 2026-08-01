using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using EGlobal.TotalPOS.Peru.SDK.Interfaz.Exceptions;
using EGlobal.TotalPOS.Peru.SDK.Interfaz.Layout;

namespace OpenPayBridge
{
    /// <summary>
    /// Servicio HTTP local que expone el SDK OpenPay como API REST para el
    /// proceso Electron. Escucha en <c>http://localhost:9091</c> (puerto
    /// configurable con <c>OPENPAY_BRIDGE_PORT</c>).
    ///
    /// Escrito en C# 5.0 para poder compilarse con el csc.exe que trae Windows
    /// (Framework64\v4.0.30319) sin dependencia de Visual Studio ni Roslyn.
    /// </summary>
    internal static class Program
    {
        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
        private static StreamWriter _logWriter;

        public static int Main(string[] args)
        {
            var exeDir = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);
            Environment.CurrentDirectory = exeDir; // el SDK lee pinpad.config/Local.config del CWD

            OpenLog(Path.Combine(exeDir, "bridge.log"));

            int port;
            if (!int.TryParse(Environment.GetEnvironmentVariable("OPENPAY_BRIDGE_PORT"), out port))
                port = 9091;
            var prefix = string.Format("http://localhost:{0}/", port);

            Log("=== openpay-bridge starting on {0} ===", prefix);
            Log("CWD: {0}", exeDir);

            var listener = new HttpListener();
            listener.Prefixes.Add(prefix);
            try
            {
                listener.Start();
            }
            catch (Exception ex)
            {
                Log("FATAL: no se pudo abrir el listener: {0}", ex.Message);
                return 2;
            }

            var stop = new ManualResetEventSlim();
            Console.CancelKeyPress += delegate(object s, ConsoleCancelEventArgs e) { e.Cancel = true; stop.Set(); };

            Task.Run(new Func<Task>(async delegate
            {
                while (listener.IsListening)
                {
                    HttpListenerContext ctx;
                    try { ctx = await listener.GetContextAsync().ConfigureAwait(false); }
                    catch (HttpListenerException) { break; }
                    catch (ObjectDisposedException) { break; }

                    var localCtx = ctx;
                    Task.Run(new Action(delegate { HandleRequest(localCtx); }));
                }
            }));

            stop.Wait();
            Log("shutting down...");
            try { listener.Stop(); listener.Close(); } catch { }
            CloseLog();
            return 0;
        }

        private static void HandleRequest(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;
            var path = req.Url.AbsolutePath.ToLowerInvariant().TrimEnd('/');
            var method = req.HttpMethod.ToUpperInvariant();

            try
            {
                Log("{0} {1}", method, path);

                if (method == "GET" && path == "/health")
                {
                    var health = new Dictionary<string, object>();
                    health.Add("ok", true);
                    health.Add("initialized", SdkClient.IsInitialized);
                    WriteJson(res, 200, health);
                    return;
                }

                if (method != "POST")
                {
                    var err = new Dictionary<string, object>();
                    err.Add("ok", false);
                    err.Add("error", "Method not allowed");
                    WriteJson(res, 405, err);
                    return;
                }

                var body = ReadBody(req);
                Dictionary<string, object> payload;
                if (string.IsNullOrEmpty(body))
                {
                    payload = new Dictionary<string, object>();
                }
                else
                {
                    payload = (Dictionary<string, object>)Json.DeserializeObject(body);
                }

                switch (path)
                {
                    case "/openpay/init":
                        SdkClient.Initialize(Path.Combine(Environment.CurrentDirectory, "Local.config"));
                        var ok = new Dictionary<string, object>();
                        ok.Add("ok", true);
                        ok.Add("initialized", true);
                        WriteJson(res, 200, ok);
                        return;

                    case "/openpay/carga-llaves":
                        WriteRespuesta(res, SdkClient.LoadKeys());
                        return;

                    case "/openpay/venta":
                        WriteRespuesta(res, SdkClient.Sale(Str(payload, "amount")));
                        return;

                    case "/openpay/venta-qr":
                        WriteRespuesta(res, SdkClient.SaleQR(Str(payload, "amount")));
                        return;

                    case "/openpay/venta-qr/cancel":
                        var cancelled = SdkClient.CancelSaleQR();
                        var cancelDto = new Dictionary<string, object>();
                        cancelDto.Add("ok", true);
                        cancelDto.Add("cancelled", cancelled);
                        WriteJson(res, 200, cancelDto);
                        return;

                    case "/openpay/anulacion":
                        WriteRespuesta(res, SdkClient.VoidSale(
                            Str(payload, "amount"),
                            Str(payload, "financialReference")));
                        return;

                    case "/openpay/anulacion-qr":
                        WriteRespuesta(res, SdkClient.VoidSaleQR(
                            Str(payload, "amount"),
                            Str(payload, "financialReference")));
                        return;

                    case "/openpay/cierre":
                        WriteRespuesta(res, SdkClient.CloseTurn());
                        return;
                }

                var notFound = new Dictionary<string, object>();
                notFound.Add("ok", false);
                notFound.Add("error", "Not found: " + path);
                WriteJson(res, 404, notFound);
            }
            catch (PeticionException pex)
            {
                Log("PeticionException: {0}", pex.Message);
                var err = new Dictionary<string, object>();
                err.Add("ok", false);
                err.Add("error", pex.Message);
                err.Add("type", "PeticionException");
                WriteJson(res, 500, err);
            }
            catch (Exception ex)
            {
                Log("Exception: {0}", ex);
                var err = new Dictionary<string, object>();
                err.Add("ok", false);
                err.Add("error", ex.Message);
                err.Add("type", ex.GetType().Name);
                WriteJson(res, 500, err);
            }
        }

        private static string Str(Dictionary<string, object> o, string k)
        {
            object v;
            if (o != null && o.TryGetValue(k, out v) && v != null) return v.ToString();
            return string.Empty;
        }

        private static string ReadBody(HttpListenerRequest req)
        {
            using (var sr = new StreamReader(req.InputStream, req.ContentEncoding))
                return sr.ReadToEnd();
        }

        private static string S(string v) { return v == null ? "" : v; }

        private static void WriteRespuesta(HttpListenerResponse res, Respuesta r)
        {
            // response_code=="00" es aprobada según la especificación OpenPay/EGlobal.
            // Refuerzo defensivo: en cancelaciones de VentaQR el SDK a veces
            // devuelve Respuesta con CodigoRespuesta vacío o con datos vacíos.
            // Requerimos también que exista un IdTransaccion o Autorizacion,
            // así una cancel no queda como aprobada.
            var approved = r != null
                && r.CodigoRespuesta == "00"
                && (!string.IsNullOrEmpty(r.IdTransaccion) || !string.IsNullOrEmpty(r.Autorizacion));

            // Log detallado para diagnosticar cancelaciones y estados raros.
            if (r == null)
            {
                Log("Respuesta: NULL");
            }
            else
            {
                Log("Respuesta: codigo='{0}' leyenda='{1}' auth='{2}' idTx='{3}' finRef='{4}' approved={5}",
                    S(r.CodigoRespuesta), S(r.Leyenda), S(r.Autorizacion),
                    S(r.IdTransaccion), S(r.ReferenciaFinanciera), approved);
            }
            var dto = new Dictionary<string, object>();
            dto.Add("ok", approved);
            dto.Add("responseCode", r == null ? "" : S(r.CodigoRespuesta));
            dto.Add("legend", r == null ? "" : S(r.Leyenda));
            dto.Add("transactionId", r == null ? "" : S(r.IdTransaccion));
            dto.Add("authorization", r == null ? "" : S(r.Autorizacion));
            dto.Add("financialReference", r == null ? "" : S(r.ReferenciaFinanciera));
            dto.Add("operationCode", r == null ? "" : S(r.CodigoTransaccion));
            dto.Add("operationName", r == null ? "" : S(r.NombreTransaccion));
            dto.Add("sequence", r == null ? "" : S(r.SecuenciaTransaccion));
            dto.Add("amount", r == null ? "" : S(r.Importe));
            dto.Add("tip", r == null ? "" : S(r.Propina));
            dto.Add("folio", r == null ? "" : S(r.Folio));
            dto.Add("operatorId", r == null ? "" : S(r.Operador));
            dto.Add("sign", r == null ? "" : S(r.Firma));
            dto.Add("dateTime", r == null ? "" : S(r.FechaHora));
            // Comercio
            dto.Add("merchantId", r == null ? "" : S(r.Afiliacion));
            dto.Add("merchantIdAmex", r == null ? "" : S(r.AfiliacionAmex));
            dto.Add("currency", r == null ? "" : S(r.Moneda));
            dto.Add("merchantName", r == null ? "" : S(r.RazonSocial));
            dto.Add("merchantAddress", r == null ? "" : S(r.Direccion));
            dto.Add("terminalNumber", r == null ? "" : S(r.NumeroTerminal));
            dto.Add("terminalSerial", r == null ? "" : S(r.SerieTerminal));
            dto.Add("turnId", r == null ? "" : S(r.IdTurno));
            // Tarjeta (siempre enmascarada; el PPD nunca entrega el PAN)
            dto.Add("cardNumber", r == null ? "" : S(r.NumeroTarjeta));
            dto.Add("cardHolder", r == null ? "" : S(r.Tarjetahabiente));
            dto.Add("readMode", r == null ? "" : S(r.ModoLectura));
            dto.Add("cardProduct", r == null ? "" : S(r.ProductoTarjeta));
            dto.Add("cardIssuer", r == null ? "" : S(r.EmisorTarjeta));
            dto.Add("cardAppId", r == null ? "" : S(r.IdAplicacionTarjeta));
            dto.Add("cardAppName", r == null ? "" : S(r.AplicacionTarjeta));
            dto.Add("cardCryptogram", r == null ? "" : S(r.CriptogramaTarjeta));
            // Billetera / QR
            dto.Add("walletId", r == null ? "" : S(r.IdBilletera));
            dto.Add("walletName", r == null ? "" : S(r.Billetera));
            // Cuotas / promociones
            dto.Add("promoCode", r == null ? "" : S(r.CodigoPromocion));
            dto.Add("financing", r == null ? "" : S(r.Financiamiento));
            dto.Add("installments", r == null ? "" : S(r.Cuotas));
            dto.Add("installmentAmount", r == null ? "" : S(r.MontoCuota));
            dto.Add("messages", r == null || r.Mensajes == null ? new string[0] : r.Mensajes);

            WriteJson(res, 200, dto);
        }

        private static void WriteJson(HttpListenerResponse res, int status, object payload)
        {
            res.StatusCode = status;
            res.ContentType = "application/json; charset=utf-8";
            var bytes = Encoding.UTF8.GetBytes(Json.Serialize(payload));
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.OutputStream.Close();
        }

        private static void OpenLog(string path)
        {
            try
            {
                _logWriter = new StreamWriter(new FileStream(path, FileMode.Append, FileAccess.Write, FileShare.Read));
                _logWriter.AutoFlush = true;
            }
            catch { /* si no puede abrir el log, seguimos solo con Console */ }
        }

        private static void CloseLog()
        {
            try { if (_logWriter != null) _logWriter.Dispose(); } catch { }
        }

        private static void Log(string fmt, params object[] args)
        {
            var line = string.Format("[{0:HH:mm:ss.fff}] {1}", DateTime.Now, string.Format(fmt, args));
            Console.WriteLine(line);
            try { if (_logWriter != null) _logWriter.WriteLine(line); } catch { }
        }
    }
}
