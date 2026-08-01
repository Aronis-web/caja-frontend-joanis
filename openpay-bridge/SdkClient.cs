using System;
using System.Collections.Generic;
using System.Xml;
using EGlobal.TotalPOS.Peru.SDK.Interfaz.Authorizer;
using EGlobal.TotalPOS.Peru.SDK.Interfaz.Catalog;
using EGlobal.TotalPOS.Peru.SDK.Interfaz.Layout;
using EGlobal.TotalPOS.Peru.SDK.Interfaz.Util;

namespace OpenPayBridge
{
    /// <summary>
    /// Wrapper thread-safe alrededor del SDK EGlobal.TotalPOS.Peru.SDK.
    /// Mantiene un único <see cref="Interfaz"/> inicializado y serializa el
    /// acceso al PinPad (el terminal físico no soporta operaciones concurrentes).
    ///
    /// Escrito en C# 5.0 para poder compilarse con el csc.exe que trae Windows
    /// (Framework64\v4.0.30319) sin dependencia de Visual Studio ni Roslyn.
    /// </summary>
    internal sealed class SdkClient
    {
        private static readonly object _gate = new object();
        private static bool _initialized;
        private static string _operatorId = "01";

        public static bool IsInitialized
        {
            get { lock (_gate) { return _initialized; } }
        }

        /// <summary>Carga <c>Local.config</c> y ejecuta <c>Interfaz.Inicializar()</c>.</summary>
        public static void Initialize(string configPath)
        {
            lock (_gate)
            {
                if (_initialized) return;

                var doc = new XmlDocument();
                doc.Load(configPath);

                _operatorId = V(doc, "/configuracion/sdk/claveoperador/@value");

                var configuracion = new Configuracion();
                configuracion.Logs = B(doc, "/configuracion/sdk/logs/@value");
                configuracion.PinPadConexion = V(doc, "/configuracion/sdk/pinpadconexion/@value");
                configuracion.PinPadPuerto = V(doc, "/configuracion/sdk/pinpadpuerto/@value");
                configuracion.PinPadAndroid = B(doc, "/configuracion/sdk/android/@value");
                configuracion.PinPadTimeOut = V(doc, "/configuracion/sdk/pinpadtimeout/@value");
                configuracion.PinPadMensaje = V(doc, "/configuracion/sdk/pinpadmensaje/@value");
                configuracion.RutaBase = V(doc, "/configuracion/sdk/rutabase/@value");
                configuracion.HostUrl = V(doc, "/configuracion/sdk/hosturl/@value");
                configuracion.UrlProxy = V(doc, "/configuracion/sdk/urlproxy/@value");
                configuracion.PuertoProxy = V(doc, "/configuracion/sdk/puertoproxy/@value");
                configuracion.HostTimeOut = V(doc, "/configuracion/sdk/hosttimeout/@value");
                configuracion.Afiliacion = V(doc, "/configuracion/sdk/afiliacion/@value");
                configuracion.MonedaAfiliacion = V(doc, "/configuracion/sdk/monedaafiliacion/@value") == "USD"
                    ? Moneda.Dolares
                    : Moneda.Soles;
                configuracion.IdAplicacion = V(doc, "/configuracion/sdk/idaplicacion/@value");
                configuracion.ClaveSecreta = V(doc, "/configuracion/sdk/clavesecreta/@value");
                configuracion.NumeroTerminal = V(doc, "/configuracion/sdk/numeroterminal/@value");

                Interfaz.Instance.Configuracion = configuracion;
                Interfaz.Instance.Inicializar();
                _initialized = true;
            }
        }

        private static string V(XmlDocument doc, string xpath)
        {
            var n = doc.SelectSingleNode(xpath);
            return n == null ? string.Empty : n.Value;
        }

        private static bool B(XmlDocument doc, string xpath)
        {
            return V(doc, xpath) == "1";
        }

        private static Respuesta RunLocked(Operacion op, Dictionary<ParametroOperacion, object> parametros)
        {
            lock (_gate)
            {
                if (!_initialized)
                    throw new InvalidOperationException("SDK no inicializado. Llamar /openpay/init primero.");

                var peticion = new Peticion();
                peticion.Operador = _operatorId;
                peticion.Fecha = DateTime.Now.ToString("yyyyMMddHHmmss");
                peticion.SetOperacion(op, parametros);
                return peticion.Autorizar();
            }
        }

        public static Respuesta LoadKeys()
        {
            return RunLocked(Operacion.CargaLlaves, null);
        }

        public static Respuesta Sale(string amount)
        {
            var p = new Dictionary<ParametroOperacion, object>();
            p.Add(ParametroOperacion.Importe, amount);
            return RunLocked(Operacion.Venta, p);
        }

        // Instancia activa de una VentaQR en curso, guardada para poder cancelarla
        // desde otro hilo (endpoint /openpay/venta-qr/cancel). Al finalizar la
        // operación (aprobada, rechazada o cancelada) se limpia.
        private static readonly object _qrLock = new object();
        private static Peticion _qrPeticion;

        /// <summary>
        /// Venta QR: flujo de dos pasos según SDK EGlobal:
        ///  1) <c>GenerarQR()</c> muestra el QR en el PPD (o lo entrega en la Respuesta).
        ///  2) <c>FinalizarVentaQR()</c> bloquea polling contra el host hasta que la
        ///     wallet paga o vence el timeout, devolviendo la <see cref="Respuesta"/>.
        /// Se puede abortar desde <see cref="CancelSaleQR"/> mientras está en curso.
        /// </summary>
        public static Respuesta SaleQR(string amount)
        {
            Peticion peticion;
            lock (_gate)
            {
                if (!_initialized)
                    throw new InvalidOperationException("SDK no inicializado. Llamar /openpay/init primero.");

                var p = new Dictionary<ParametroOperacion, object>();
                p.Add(ParametroOperacion.Importe, amount);

                peticion = new Peticion();
                peticion.Operador = _operatorId;
                peticion.Fecha = DateTime.Now.ToString("yyyyMMddHHmmss");
                peticion.SetOperacion(Operacion.VentaQR, p);
                peticion.GenerarQR();

                lock (_qrLock) { _qrPeticion = peticion; }
            }
            try
            {
                return peticion.FinalizarVentaQR();
            }
            finally
            {
                lock (_qrLock) { if (_qrPeticion == peticion) _qrPeticion = null; }
            }
        }

        /// <summary>
        /// Cancela una VentaQR en curso. Devuelve <c>true</c> si había una
        /// operación activa que fue cancelada, <c>false</c> si no había nada
        /// pendiente. No adquiere el <c>_gate</c> principal (para no deadlockear
        /// contra la llamada bloqueada en <c>FinalizarVentaQR</c>).
        /// </summary>
        public static bool CancelSaleQR()
        {
            lock (_qrLock)
            {
                if (_qrPeticion == null) return false;
                _qrPeticion.CancelarVentaQR();
                return true;
            }
        }

        public static Respuesta VoidSale(string amount, string financialReference)
        {
            var p = new Dictionary<ParametroOperacion, object>();
            p.Add(ParametroOperacion.Importe, amount);
            p.Add(ParametroOperacion.ReferenciaFinanciera, financialReference);
            return RunLocked(Operacion.AnulacionVenta, p);
        }

        public static Respuesta VoidSaleQR(string amount, string financialReference)
        {
            var p = new Dictionary<ParametroOperacion, object>();
            p.Add(ParametroOperacion.Importe, amount);
            p.Add(ParametroOperacion.ReferenciaFinanciera, financialReference);
            return RunLocked(Operacion.AnulacionVentaQR, p);
        }

        public static Respuesta CloseTurn()
        {
            return RunLocked(Operacion.CierreTurno, null);
        }
    }
}
