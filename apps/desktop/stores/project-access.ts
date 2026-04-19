'use client';

import { create } from 'zustand';
import {
  getSetting,
  listProjectAccessGrants,
  revokeProjectAccessGrant,
  saveProjectAccessGrant,
  setSetting,
  type ProjectAccessGrant,
  type ProjectPermissionLevel,
} from '@/lib/tauri';

const STARTER_PROJECT_SETTING_KEY = 'starter_project_access_id';

interface ProjectAccessState {
  grants: ProjectAccessGrant[];
  starterProjectId: string | null;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  loadGrants: () => Promise<void>;
  saveGrant: (
    path: string,
    permissionLevel?: ProjectPermissionLevel,
  ) => Promise<ProjectAccessGrant>;
  revokeGrant: (id: string) => Promise<void>;
  setStarterProjectId: (id: string | null) => Promise<void>;
  getGrantById: (id: string | null | undefined) => ProjectAccessGrant | null;
}

function sortGrants(grants: ProjectAccessGrant[]): ProjectAccessGrant[] {
  return [...grants].sort((left, right) => right.updatedAt - left.updatedAt);
}

export const useProjectAccessStore = create<ProjectAccessState>((set, get) => ({
  grants: [],
  starterProjectId: null,
  loading: false,
  error: null,

  init: async () => {
    set({ loading: true, error: null });

    try {
      const [grants, storedStarterProjectId] = await Promise.all([
        listProjectAccessGrants(),
        getSetting(STARTER_PROJECT_SETTING_KEY),
      ]);
      const starterProjectId =
        storedStarterProjectId && grants.some((grant) => grant.id === storedStarterProjectId)
          ? storedStarterProjectId
          : null;

      if (storedStarterProjectId && !starterProjectId) {
        await setSetting(STARTER_PROJECT_SETTING_KEY, '');
      }

      set({
        grants: sortGrants(grants),
        starterProjectId,
        loading: false,
        error: null,
      });
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  loadGrants: async () => {
    try {
      const grants = await listProjectAccessGrants();
      const currentStarterProjectId = get().starterProjectId;
      const starterProjectId =
        currentStarterProjectId && grants.some((grant) => grant.id === currentStarterProjectId)
          ? currentStarterProjectId
          : null;

      if (currentStarterProjectId && !starterProjectId) {
        await setSetting(STARTER_PROJECT_SETTING_KEY, '');
      }

      set({
        grants: sortGrants(grants),
        starterProjectId,
        error: null,
      });
    } catch (error) {
      set({ error: String(error) });
    }
  },

  saveGrant: async (path, permissionLevel = 'read') => {
    const grant = await saveProjectAccessGrant(path, permissionLevel);
    set((state) => {
      const nextGrants = state.grants.filter((item) => item.id !== grant.id);
      nextGrants.unshift(grant);

      return {
        grants: sortGrants(nextGrants),
        error: null,
      };
    });

    return grant;
  },

  revokeGrant: async (id) => {
    await revokeProjectAccessGrant(id);

    const starterProjectId = get().starterProjectId === id ? null : get().starterProjectId;
    if (get().starterProjectId === id) {
      await setSetting(STARTER_PROJECT_SETTING_KEY, '');
    }

    set((state) => ({
      grants: state.grants.filter((grant) => grant.id !== id),
      starterProjectId,
      error: null,
    }));
  },

  setStarterProjectId: async (id) => {
    if (id && !get().grants.some((grant) => grant.id === id)) {
      throw new Error('Selected project grant no longer exists.');
    }

    await setSetting(STARTER_PROJECT_SETTING_KEY, id ?? '');
    set({ starterProjectId: id, error: null });
  },

  getGrantById: (id) => {
    if (!id) {
      return null;
    }

    return get().grants.find((grant) => grant.id === id) ?? null;
  },
}));
