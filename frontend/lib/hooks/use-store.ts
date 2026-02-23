import { create } from 'zustand';

interface KinematicsState {
  chain: string;
  result: Record<string, unknown> | null;
  loading: boolean;
  setChain: (v: string) => void;
  setResult: (v: Record<string, unknown> | null) => void;
  setLoading: (v: boolean) => void;
  reset: () => void;
}

export const useKinematicsStore = create<KinematicsState>((set) => ({
  chain: 'human_arm',
  result: null,
  loading: false,
  setChain: (chain) => set({ chain }),
  setResult: (result) => set({ result }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ chain: 'human_arm', result: null, loading: false }),
}));
