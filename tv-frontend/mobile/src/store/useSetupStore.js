import { create } from "zustand";
const useSetupStore = create((set, get) => ({
  // Session
  session: null,
  sessionValid: false,
  sessionLoading: true,
  // Current step (1=details, 2=login, 3=success)
  step: 1,
  // Step 1: User details
  name: "Ajay Bhardwaj",
  vpa: "",
  phone: "9910234090",
  // Connected merchants
  merchants: [],
  // Success
  isSynced: false,
  // Actions
  setSession: (session) => set({ session }),
  setSessionValid: (valid) =>
    set({ sessionValid: valid, sessionLoading: false }),
  setStep: (step) => set({ step }),
  setName: (name) => set({ name }),
  setVpa: (vpa) => set({ vpa }),
  setPhone: (phone) => set({ phone }),
  toggleMerchant: (merchantId) =>
    set((state) => {
      const merchants = state.merchants.includes(merchantId)
        ? state.merchants.filter((m) => m !== merchantId)
        : [...state.merchants, merchantId];
      return { merchants };
    }),
  setIsSynced: (synced) => set({ isSynced: synced }),
  goNext: () => set((state) => ({ step: Math.min(state.step + 1, 3) })),
  goBack: () => set((state) => ({ step: Math.max(state.step - 1, 1) })),
  reset: () =>
    set({
      step: 1,
      name: "Ajay Bhardwaj",
      vpa: "",
      phone: "9910234090",
      merchants: [],
      isSynced: false,
    }),
}));
export default useSetupStore;
