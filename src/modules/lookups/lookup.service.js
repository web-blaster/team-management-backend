import { StatusCode } from '../../constants/statusCodes.js';
import { lookupRepository } from './lookup.repository.js';
export class LookupService{async getAll(){return lookupRepository.getAll(StatusCode.ACTIVE);}}
export const lookupService=new LookupService();
