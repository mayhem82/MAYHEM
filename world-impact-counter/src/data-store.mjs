import { validateDataset, RateLedger, datasetRates } from './engine.mjs';
export class DatasetStore {
  constructor() { this.data = null; this.lastChecked = null; this.error = null; this.ledger = new RateLedger(); }
  accept(candidate, seconds, checkedAt = new Date()) {
    const data = validateDataset(candidate);
    if (this.data?.version === data.version && JSON.stringify(this.data) !== JSON.stringify(data)) throw new Error('Dataset changed without a version change');
    this.ledger.update(datasetRates(data), seconds);
    this.data = data; this.lastChecked = checkedAt; this.error = null;
  }
  fail(error) { this.error = error.message || 'Source check failed'; }
}
