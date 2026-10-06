// What a task is about, in words: an account's set-up task names the account
// when no customer or deal is attached (sparx persona issue 087).
import { describe, expect, it } from 'vitest';
import { taskSubject, type Task } from './tasks-data';

const base = { customer: null, deal: null, company: null } as unknown as Task;

describe('taskSubject', () => {
  it('names the account when that is all the task is about', () => {
    const task = { ...base, company: { companyName: 'Wasatch Front Utility Contractors, LLC' } };
    expect(taskSubject(task)).toBe('Wasatch Front Utility Contractors, LLC');
  });

  it('says nothing for a general to-do', () => {
    expect(taskSubject(base)).toBeNull();
  });
});
