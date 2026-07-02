// sparx Partner Program — schema package barrel (docs/114).
//
// Single source of truth for the shape of every write into the Partner Program
// (application, profile, referral hooks, bootcamp CRUD, RSVP) + the public
// directory queries. The api-rest service layer, the dashboard Partner Portal,
// and the sparx.works public pages all validate inputs against these Zod schemas.

export * from './common';
export * from './partners';
export * from './bootcamps';
