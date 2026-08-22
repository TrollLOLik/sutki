import { runtimeConfig } from '@shared/config/runtime';
import type { RequestRepository } from './requestRepository';
import { HttpRequestRepository } from './httpRequestRepository';
import { mockRequestRepository } from './mockRequestRepository';

export const REQUEST_DATA_MODE = runtimeConfig.requestDataMode;
export const requestRepository: RequestRepository = REQUEST_DATA_MODE === 'http'
  ? new HttpRequestRepository()
  : mockRequestRepository;
