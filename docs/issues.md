1 - how and where is a tenant named? this needs to be consistent and clear
2 - how do we handle tenant-specific data in the builder? is there a standard way to scope data to a tenant?
3 - how do we manage tenant-specific configurations or settings in the builder? is there a recommended approach for storing and retrieving these settings?
4 - how do we handle tenant-specific assets (like images, stylesheets, etc.) in the builder? is there a best practice for organizing and referencing these assets?
5 - when we create urls for sites/properties in the dashboard, we are currently creating them like: https://korous-store-brandonkorous.sparx.zone/

- should we be creating them like: https://korous-store.sparx.zone/ instead? (without the tenant name in the url)
- if we keep the tenant name in the url, how do we ensure that it is consistent and doesn't cause confusion for users? if we keep the tenant name in the url it should be like https://brandonkorous.korous-store.sparx.zone/ to be consistent.
