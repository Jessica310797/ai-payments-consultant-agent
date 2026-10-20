// Where the app gets its data. Today: the demo fixtures. Replace loadDataset() with an API call to use real data.
import { demoChanges } from './fixtures/changes';
import { ledger } from './fixtures/ledger';
import { demoBenchmarks, demoInvoices, demoMerchant, demoMeta, demoProviders, demoRouting } from './fixtures/merchant';
import type { Dataset } from './types';

export type DemoState = 'normal' | 'loading' | 'empty' | 'error';

export async function loadDataset(demo: DemoState = 'normal'): Promise<Dataset> {
  await new Promise((r) => setTimeout(r, 450));
  if (demo === 'loading') await new Promise(() => undefined); // never resolves: shows the loading state
  if (demo === 'error') throw new Error('The payments data service didn\'t respond (demo error).');
  return {
    meta: demoMeta,
    merchant: demoMerchant,
    providers: demoProviders,
    ledger: demo === 'empty' ? [] : ledger,
    invoices: demo === 'empty' ? [] : demoInvoices,
    changes: demoChanges,
    benchmarks: demoBenchmarks,
    routing: demoRouting,
  };
}
