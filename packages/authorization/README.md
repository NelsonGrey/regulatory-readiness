# @rre/authorization

Roles, capabilities, and the capability matrix — the single place role grants
live (engine detailed design 01 §3, TRD §15.1).

`can(role, capability)` is the coarse workspace-level check. The API layers
object-level, tenant, and pack scoping on top; authorization is always enforced
server-side (TRD §15.3). Contributor and reviewer token principals are handled
separately and hold no workspace capabilities.
