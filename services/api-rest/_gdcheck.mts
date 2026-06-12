// TEMP — validate enriched getDomainSuggestions: real reg + renewal prices,
// accurate availability, correct unit (cents). Free read. Deleted after.
import 'dotenv/config';
import { getDomainSuggestions } from '@sparx/godaddy';

const q = process.argv[2] ?? 'gillett diesel';
const s = await getDomainSuggestions(q);
console.log(`suggest("${q}") → ${s.length} results`);
for (const x of s) {
  console.log(
    `  ${x.domain.padEnd(30)} ${(x.available ? 'avail' : 'taken').padEnd(5)} ` +
      `reg $${(x.price / 100).toFixed(2).padStart(7)}   renew $${(x.renewalPrice / 100).toFixed(2).padStart(7)}`
  );
}
