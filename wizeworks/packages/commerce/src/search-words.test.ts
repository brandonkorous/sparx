// The second line under a search result reads as words (issue 914).

import { describe, expect, it } from 'vitest';
import {
  bundlePricingWords,
  codeAsWords,
  collectionKindWords,
  companyStatusWords,
  entryStatusWords,
  fileKindWords,
  paymentStatusWords,
  pipelineObjectWords,
  returnOutcomeWords,
  segmentKindWords,
  taskLineWords,
  taskPriorityWords,
} from './search-words';

/** A stored code: lower case, joined by "_", "-" or "/". */
const LOOKS_LIKE_CODE = /^[a-z0-9]+([_/-][a-z0-9]+)+$|^[a-z]+$/;

describe('search result second lines', () => {
  it('never hand back the stored code for a known value', () => {
    const said = [
      segmentKindWords('dynamic'),
      segmentKindWords('static'),
      collectionKindWords('manual'),
      collectionKindWords('rules'),
      pipelineObjectWords('deal'),
      pipelineObjectWords('ticket'),
      bundlePricingWords('sum_of_components'),
      bundlePricingWords('fixed'),
      bundlePricingWords('percent_off_sum'),
      returnOutcomeWords('refund'),
      returnOutcomeWords('account_credit'),
      returnOutcomeWords('exchange'),
      returnOutcomeWords('repair'),
      companyStatusWords('credit_hold'),
      paymentStatusWords('unpaid'),
      paymentStatusWords('void'),
      taskPriorityWords('high'),
      entryStatusWords('draft'),
      fileKindWords('image/jpeg'),
    ];
    for (const words of said) expect(words).not.toMatch(LOOKS_LIKE_CODE);
  });

  it('says what each one means', () => {
    expect(segmentKindWords('static')).toBe('Picked by hand');
    expect(returnOutcomeWords('account_credit')).toBe('Wants credit on their account');
    expect(paymentStatusWords('partial')).toBe('Partly paid');
    expect(taskPriorityWords('urgent')).toBe('Urgent');
    expect(taskLineWords('open', 'medium')).toBe('Medium priority');
    expect(taskLineWords('completed', 'medium')).toBe('Done');
    expect(taskLineWords('cancelled', 'high')).toBe('Canceled');
    expect(fileKindWords('application/pdf')).toBe('PDF');
    expect(fileKindWords('video/mp4')).toBe('Video');
    expect(fileKindWords('application/zip')).toBe('File');
  });

  it('reads a code no map knows yet as words, not as itself', () => {
    expect(codeAsWords('credit_hold')).toBe('Credit hold');
    expect(companyStatusWords('on_review')).toBe('On review');
    expect(pipelineObjectWords('trade_show')).toBe('For trade show');
  });
});
