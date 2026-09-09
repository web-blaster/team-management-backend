import { healthRepository } from './health.repository.js';
export class HealthService{async check(){await healthRepository.ping();return {status:'ok'};}}
export const healthService=new HealthService();
