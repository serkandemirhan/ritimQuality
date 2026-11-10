/** Server-managed pilot entitlement; never trust a client-provided flag. */
export function isUnlimitedPilotWorkspace(slug:unknown,configuration=process.env.UNLIMITED_PILOT_WORKSPACES||''):boolean{
 if(typeof slug!=='string'||!/^[a-z0-9][a-z0-9-]{2,48}$/.test(slug))return false;
 return configuration.split(',').map(value=>value.trim()).filter(value=>/^[a-z0-9][a-z0-9-]{2,48}$/.test(value)).includes(slug);
}

export function hasUnlimitedPilot(tenant:{slug?:unknown;pilot_unlimited?:unknown}):boolean{
 return typeof tenant.pilot_unlimited==='boolean'?tenant.pilot_unlimited:isUnlimitedPilotWorkspace(tenant.slug);
}
