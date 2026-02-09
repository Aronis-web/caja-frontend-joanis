import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  siteId: string;
  isActive: boolean;
}

export interface Site {
  id: string;
  code: string;
  name: string;
  companyId: string;
  isActive: boolean;
}

export interface Company {
  id: string;
  name: string;
  alias?: string;
  ruc?: string;
  isActive: boolean;
}

interface TenantState {
  selectedCompany: Company | null;
  selectedSite: Site | null;
  selectedWarehouse: Warehouse | null;

  // Actions
  setSelectedCompany: (company: Company | null) => Promise<void>;
  setSelectedSite: (site: Site | null) => Promise<void>;
  setSelectedWarehouse: (warehouse: Warehouse | null) => Promise<void>;
  clearTenantContext: () => Promise<void>;
  initTenantContext: () => Promise<void>;
}

const STORAGE_KEYS = {
  SELECTED_COMPANY: 'tenant_selected_company',
  SELECTED_SITE: 'tenant_selected_site',
  SELECTED_WAREHOUSE: 'tenant_selected_warehouse',
};

export const useTenantStore = create<TenantState>((set, get) => ({
  selectedCompany: null,
  selectedSite: null,
  selectedWarehouse: null,

  setSelectedCompany: async (company) => {
    set({ selectedCompany: company });
    if (company) {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_COMPANY, JSON.stringify(company));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_COMPANY);
    }
  },

  setSelectedSite: async (site) => {
    set({ selectedSite: site });
    if (site) {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_SITE, JSON.stringify(site));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_SITE);
    }
  },

  setSelectedWarehouse: async (warehouse) => {
    set({ selectedWarehouse: warehouse });
    if (warehouse) {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_WAREHOUSE, JSON.stringify(warehouse));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_WAREHOUSE);
    }
  },

  clearTenantContext: async () => {
    set({
      selectedCompany: null,
      selectedSite: null,
      selectedWarehouse: null,
    });
    await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_COMPANY);
    await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_SITE);
    await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_WAREHOUSE);
  },

  initTenantContext: async () => {
    try {
      console.log('🏢 Starting tenant context initialization...');

      const companyJson = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_COMPANY);
      const siteJson = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_SITE);
      const warehouseJson = await AsyncStorage.getItem(STORAGE_KEYS.SELECTED_WAREHOUSE);

      console.log('📦 Loaded tenant data:', {
        hasCompany: !!companyJson,
        hasSite: !!siteJson,
        hasWarehouse: !!warehouseJson,
      });

      let selectedCompany = null;
      let selectedSite = null;
      let selectedWarehouse = null;

      if (companyJson) {
        try {
          selectedCompany = JSON.parse(companyJson);
        } catch (parseError) {
          console.error('❌ Failed to parse company JSON:', parseError);
          await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_COMPANY);
        }
      }

      if (siteJson) {
        try {
          selectedSite = JSON.parse(siteJson);
        } catch (parseError) {
          console.error('❌ Failed to parse site JSON:', parseError);
          await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_SITE);
        }
      }

      if (warehouseJson) {
        try {
          selectedWarehouse = JSON.parse(warehouseJson);
        } catch (parseError) {
          console.error('❌ Failed to parse warehouse JSON:', parseError);
          await AsyncStorage.removeItem(STORAGE_KEYS.SELECTED_WAREHOUSE);
        }
      }

      if (!selectedCompany || !selectedSite) {
        console.log('🔄 Syncing from auth store...');
        const authCompanyJson = await AsyncStorage.getItem(config.STORAGE_KEYS.CURRENT_COMPANY);
        const authSiteJson = await AsyncStorage.getItem(config.STORAGE_KEYS.CURRENT_SITE);

        if (!selectedCompany && authCompanyJson) {
          try {
            selectedCompany = JSON.parse(authCompanyJson);
            await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_COMPANY, authCompanyJson);
            console.log('✅ Company synced from auth store');
          } catch (parseError) {
            console.error('❌ Failed to parse auth company JSON:', parseError);
          }
        }

        if (!selectedSite && authSiteJson) {
          try {
            selectedSite = JSON.parse(authSiteJson);
            await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_SITE, authSiteJson);
            console.log('✅ Site synced from auth store');
          } catch (parseError) {
            console.error('❌ Failed to parse auth site JSON:', parseError);
          }
        }
      }

      set({
        selectedCompany,
        selectedSite,
        selectedWarehouse,
      });

      console.log('🏢 Tenant context initialized:', {
        company: selectedCompany?.name || 'None',
        site: selectedSite?.name || 'None',
        warehouse: selectedWarehouse?.name || 'None',
      });
    } catch (error) {
      console.error('❌ Failed to initialize tenant context:', error);
      await get().clearTenantContext();
    }
  },
}));
