import { create } from 'zustand';
import { SSHConnectionProfile } from '../../../shared/src/types';
import { toast } from '../components/ui/toaster';
import { API_ENDPOINTS } from '../config/api';
import { useAuthStore } from './authStore';

interface SSHState {
  profiles: SSHConnectionProfile[];
  selectedProfile: SSHConnectionProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSelectedProfile: (profile: SSHConnectionProfile | null) => void;
  createProfile: (data: {
    profile: Omit<SSHConnectionProfile, 'id' | 'createdAt' | 'lastUsed' | 'isActive'>;
    credentials: {
      password?: string;
      privateKey?: string;
      passphrase?: string;
    };
  }) => Promise<void>;
  loadProfiles: () => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  updateProfile: (id: string, updates: Partial<SSHConnectionProfile>) => Promise<void>;
}

export const useSSHStore = create<SSHState>((set, get) => ({
  profiles: [],
  selectedProfile: null,
  isLoading: false,
  error: null,

  setSelectedProfile: (profile) => {
    set({ selectedProfile: profile });
  },

  createProfile: async (data) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(API_ENDPOINTS.profiles.create, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create SSH connection');
      }

      const result = await response.json();
      
      if (result.success) {
        // Reload profiles to get the updated list
        await get().loadProfiles();
        toast.success('SSH connection created successfully!');
      } else {
        throw new Error(result.error || 'Failed to create SSH connection');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      set({ error: errorMessage });
      toast.error(`Failed to create SSH connection: ${errorMessage}`);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadProfiles: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(API_ENDPOINTS.profiles.list, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load SSH profiles');
      }

      const result = await response.json();
      
      if (result.success) {
        set({ profiles: result.data || [] });
      } else {
        throw new Error(result.error || 'Failed to load SSH profiles');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      set({ error: errorMessage });
      console.error('Failed to load SSH profiles:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProfile: async (id) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(API_ENDPOINTS.profiles.delete(id), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete SSH profile');
      }

      // Remove from local state
      set(state => ({
        profiles: state.profiles.filter(p => p.id !== id),
        selectedProfile: state.selectedProfile?.id === id ? null : state.selectedProfile
      }));

      toast.success('SSH connection deleted successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      set({ error: errorMessage });
      toast.error(`Failed to delete SSH connection: ${errorMessage}`);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (id, updates) => {
    set({ isLoading: true, error: null });
    
    try {
      const { token } = useAuthStore.getState();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(API_ENDPOINTS.profiles.update(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update SSH profile');
      }

      // Update local state
      set(state => ({
        profiles: state.profiles.map(p => 
          p.id === id ? { ...p, ...updates } : p
        ),
        selectedProfile: state.selectedProfile?.id === id 
          ? { ...state.selectedProfile, ...updates }
          : state.selectedProfile
      }));

      toast.success('SSH connection updated successfully!');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      set({ error: errorMessage });
      toast.error(`Failed to update SSH connection: ${errorMessage}`);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
})); 