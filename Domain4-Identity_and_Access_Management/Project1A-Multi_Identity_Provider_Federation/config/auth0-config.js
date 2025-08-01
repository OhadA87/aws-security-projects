"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuth0Thumbprint = exports.getAuth0Config = void 0;
const getAuth0Config = (environment) => {
    // Security: Require environment variables - no fallbacks for sensitive data
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    if (!domain) {
        throw new Error('🚨 SECURITY: AUTH0_DOMAIN environment variable is required. ' +
            'Never hard-code Auth0 domains in source code.');
    }
    if (!clientId) {
        throw new Error('🚨 SECURITY: AUTH0_CLIENT_ID environment variable is required. ' +
            'Never hard-code Auth0 client IDs in source code.');
    }
    // Validate domain format to prevent injection attacks
    if (!/^[a-zA-Z0-9-]+\.(?:auth0\.com|us\.auth0\.com|eu\.auth0\.com|au\.auth0\.com)$/.test(domain)) {
        throw new Error('🚨 SECURITY: Invalid Auth0 domain format. Expected format: tenant.region.auth0.com');
    }
    return {
        domain,
        clientId,
        jwksUri: `https://${domain}/.well-known/jwks.json`,
        issuer: `https://${domain}/`,
        audience: process.env.AUTH0_AUDIENCE || `https://${domain}/api/v2/`,
    };
};
exports.getAuth0Config = getAuth0Config;
const getAuth0Thumbprint = async (_domain) => {
    // For testing, you can use this static thumbprint for Auth0
    // In production, you should fetch this dynamically from the JWKS endpoint
    return '9e99a48a9960b14926bb7e3b6e3f1c478a45c21b';
};
exports.getAuth0Thumbprint = getAuth0Thumbprint;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXV0aDAtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXV0aDAtY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQVFPLE1BQU0sY0FBYyxHQUFHLENBQUMsV0FBbUIsRUFBZSxFQUFFO0lBQ2pFLDRFQUE0RTtJQUM1RSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQztJQUN4QyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQztJQUU3QyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDWixNQUFNLElBQUksS0FBSyxDQUNiLDhEQUE4RDtZQUM5RCwrQ0FBK0MsQ0FDaEQsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDZCxNQUFNLElBQUksS0FBSyxDQUNiLGlFQUFpRTtZQUNqRSxrREFBa0QsQ0FDbkQsQ0FBQztJQUNKLENBQUM7SUFFRCxzREFBc0Q7SUFDdEQsSUFBSSxDQUFDLDhFQUE4RSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO1FBQ2pHLE1BQU0sSUFBSSxLQUFLLENBQ2Isb0ZBQW9GLENBQ3JGLENBQUM7SUFDSixDQUFDO0lBRUQsT0FBTztRQUNMLE1BQU07UUFDTixRQUFRO1FBQ1IsT0FBTyxFQUFFLFdBQVcsTUFBTSx3QkFBd0I7UUFDbEQsTUFBTSxFQUFFLFdBQVcsTUFBTSxHQUFHO1FBQzVCLFFBQVEsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsSUFBSSxXQUFXLE1BQU0sVUFBVTtLQUNwRSxDQUFDO0FBQ0osQ0FBQyxDQUFDO0FBakNXLFFBQUEsY0FBYyxrQkFpQ3pCO0FBRUssTUFBTSxrQkFBa0IsR0FBRyxLQUFLLEVBQUUsT0FBZSxFQUFtQixFQUFFO0lBQzNFLDREQUE0RDtJQUM1RCwwRUFBMEU7SUFDMUUsT0FBTywwQ0FBMEMsQ0FBQztBQUNwRCxDQUFDLENBQUM7QUFKVyxRQUFBLGtCQUFrQixzQkFJN0IiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgaW50ZXJmYWNlIEF1dGgwQ29uZmlnIHtcbiAgZG9tYWluOiBzdHJpbmc7XG4gIGNsaWVudElkOiBzdHJpbmc7XG4gIGp3a3NVcmk6IHN0cmluZztcbiAgaXNzdWVyOiBzdHJpbmc7XG4gIGF1ZGllbmNlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjb25zdCBnZXRBdXRoMENvbmZpZyA9IChlbnZpcm9ubWVudDogc3RyaW5nKTogQXV0aDBDb25maWcgPT4ge1xuICAvLyBTZWN1cml0eTogUmVxdWlyZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgLSBubyBmYWxsYmFja3MgZm9yIHNlbnNpdGl2ZSBkYXRhXG4gIGNvbnN0IGRvbWFpbiA9IHByb2Nlc3MuZW52LkFVVEgwX0RPTUFJTjtcbiAgY29uc3QgY2xpZW50SWQgPSBwcm9jZXNzLmVudi5BVVRIMF9DTElFTlRfSUQ7XG5cbiAgaWYgKCFkb21haW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAn8J+aqCBTRUNVUklUWTogQVVUSDBfRE9NQUlOIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkLiAnICtcbiAgICAgICdOZXZlciBoYXJkLWNvZGUgQXV0aDAgZG9tYWlucyBpbiBzb3VyY2UgY29kZS4nXG4gICAgKTtcbiAgfVxuXG4gIGlmICghY2xpZW50SWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAn8J+aqCBTRUNVUklUWTogQVVUSDBfQ0xJRU5UX0lEIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIHJlcXVpcmVkLiAnICtcbiAgICAgICdOZXZlciBoYXJkLWNvZGUgQXV0aDAgY2xpZW50IElEcyBpbiBzb3VyY2UgY29kZS4nXG4gICAgKTtcbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGRvbWFpbiBmb3JtYXQgdG8gcHJldmVudCBpbmplY3Rpb24gYXR0YWNrc1xuICBpZiAoIS9eW2EtekEtWjAtOS1dK1xcLig/OmF1dGgwXFwuY29tfHVzXFwuYXV0aDBcXC5jb218ZXVcXC5hdXRoMFxcLmNvbXxhdVxcLmF1dGgwXFwuY29tKSQvLnRlc3QoZG9tYWluKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICfwn5qoIFNFQ1VSSVRZOiBJbnZhbGlkIEF1dGgwIGRvbWFpbiBmb3JtYXQuIEV4cGVjdGVkIGZvcm1hdDogdGVuYW50LnJlZ2lvbi5hdXRoMC5jb20nXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZG9tYWluLFxuICAgIGNsaWVudElkLFxuICAgIGp3a3NVcmk6IGBodHRwczovLyR7ZG9tYWlufS8ud2VsbC1rbm93bi9qd2tzLmpzb25gLFxuICAgIGlzc3VlcjogYGh0dHBzOi8vJHtkb21haW59L2AsXG4gICAgYXVkaWVuY2U6IHByb2Nlc3MuZW52LkFVVEgwX0FVRElFTkNFIHx8IGBodHRwczovLyR7ZG9tYWlufS9hcGkvdjIvYCxcbiAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRBdXRoMFRodW1icHJpbnQgPSBhc3luYyAoX2RvbWFpbjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+ID0+IHtcbiAgLy8gRm9yIHRlc3RpbmcsIHlvdSBjYW4gdXNlIHRoaXMgc3RhdGljIHRodW1icHJpbnQgZm9yIEF1dGgwXG4gIC8vIEluIHByb2R1Y3Rpb24sIHlvdSBzaG91bGQgZmV0Y2ggdGhpcyBkeW5hbWljYWxseSBmcm9tIHRoZSBKV0tTIGVuZHBvaW50XG4gIHJldHVybiAnOWU5OWE0OGE5OTYwYjE0OTI2YmI3ZTNiNmUzZjFjNDc4YTQ1YzIxYic7XG59O1xuIl19