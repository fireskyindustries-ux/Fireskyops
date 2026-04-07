import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface JobLoad {
  id: number;
  jobId: number;
  loadNumber: number;
  status: "pending" | "scheduled" | "in_transit" | "delivered";
  scheduledDate?: string;
  deliveredAt?: string;
  tankSize?: string;
  tankQuantity?: number;
  driverName?: string;
  vehicleReg?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobLoadBody {
  loadNumber: number;
  status?: "pending" | "scheduled" | "in_transit" | "delivered";
  scheduledDate?: string | null;
  deliveredAt?: string | null;
  tankSize?: string | null;
  tankQuantity?: number | null;
  driverName?: string | null;
  vehicleReg?: string | null;
  notes?: string | null;
}

export type UpdateJobLoadBody = Partial<Omit<CreateJobLoadBody, "loadNumber">>;

export const getJobLoadsQueryKey = (jobId: number) => [`/api/jobs/${jobId}/loads`] as const;

export const listJobLoads = async (jobId: number, options?: RequestInit): Promise<JobLoad[]> => {
  return customFetch(`/api/jobs/${jobId}/loads`, options);
};

export const useListJobLoads = (jobId: number): UseQueryResult<JobLoad[]> => {
  return useQuery({
    queryKey: getJobLoadsQueryKey(jobId),
    queryFn: () => listJobLoads(jobId),
    enabled: !!jobId,
  });
};

export const createJobLoad = async (jobId: number, data: CreateJobLoadBody, options?: RequestInit): Promise<JobLoad> => {
  return customFetch(`/api/jobs/${jobId}/loads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
};

export const useCreateJobLoad = (jobId: number): UseMutationResult<JobLoad, Error, CreateJobLoadBody> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobLoadBody) => createJobLoad(jobId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getJobLoadsQueryKey(jobId) }),
  });
};

export const updateJobLoad = async (jobId: number, id: number, data: UpdateJobLoadBody, options?: RequestInit): Promise<JobLoad> => {
  return customFetch(`/api/jobs/${jobId}/loads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    ...options,
  });
};

export const useUpdateJobLoad = (jobId: number): UseMutationResult<JobLoad, Error, { id: number; data: UpdateJobLoadBody }> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateJobLoad(jobId, id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getJobLoadsQueryKey(jobId) }),
  });
};

export const deleteJobLoad = async (jobId: number, id: number, options?: RequestInit): Promise<void> => {
  return customFetch(`/api/jobs/${jobId}/loads/${id}`, { method: "DELETE", ...options });
};

export const useDeleteJobLoad = (jobId: number): UseMutationResult<void, Error, number> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteJobLoad(jobId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getJobLoadsQueryKey(jobId) }),
  });
};
