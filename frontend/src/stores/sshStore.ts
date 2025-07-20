import { create } from 'zustand';
import { SSHConnectionProfile } from '@ai-terminal/shared';
import { toast } from '../components/ui/toaster';

interface SSHProfileState {
  profiles: SSHConnectionProfile[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createProfile: (profileData: { 
    profile: Partial<SSHConnectionProfile>;
    credentials: { password?: string; privateKey?: string; passphrase?: string; };
  }) => Promise<void>;
  loadProfiles: () => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  clearError: () => void;
}

export const useSSHStore = create<SSHProfileState>((set, get) => ({
  profiles: [],
  isLoading: false,
  error: null,

  createProfile: async (profileData) => {
    set({ isLoading: true, error: null });
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('http://localhost:5000/api/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create SSH profile');
      }

      const result = await response.json();
      
      if (result.success) {
        // Reload profiles to get the updated list
        await get().loadProfiles();
        toast.success('SSH connection created successfully!');
      } else {
        throw new Error(result.error || 'Failed to create SSH profile');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('http://localhost:5000/api/profiles', {
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
      console.error('Failed to load SSH profiles:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProfile: async (profileId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`http://localhost:5000/api/profiles/${profileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete SSH profile');
      }

      const result = await response.json();
      
      if (result.success) {
        // Remove the profile from the local state
        set(state => ({
          profiles: state.profiles.filter(p => p.id !== profileId)
        }));
        toast.success('SSH connection deleted successfully!');
      } else {
        throw new Error(result.error || 'Failed to delete SSH profile');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ error: errorMessage });
      toast.error(`Failed to delete SSH connection: ${errorMessage}`);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  }
})); 