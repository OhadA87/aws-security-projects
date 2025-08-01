export interface Auth0Config {
  domain: string;
  clientId: string;
  jwksUri: string;
  issuer: string;
  audience: string;
}

export const getAuth0Config = (environment: string): Auth0Config => {
  // Security: Require environment variables - no fallbacks for sensitive data
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;

  if (!domain) {
    throw new Error(
      '🚨 SECURITY: AUTH0_DOMAIN environment variable is required. ' +
      'Never hard-code Auth0 domains in source code.'
    );
  }

  if (!clientId) {
    throw new Error(
      '🚨 SECURITY: AUTH0_CLIENT_ID environment variable is required. ' +
      'Never hard-code Auth0 client IDs in source code.'
    );
  }

  // Validate domain format to prevent injection attacks
  if (!/^[a-zA-Z0-9-]+\.(?:auth0\.com|us\.auth0\.com|eu\.auth0\.com|au\.auth0\.com)$/.test(domain)) {
    throw new Error(
      '🚨 SECURITY: Invalid Auth0 domain format. Expected format: tenant.region.auth0.com'
    );
  }

  return {
    domain,
    clientId,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    issuer: `https://${domain}/`,
    audience: process.env.AUTH0_AUDIENCE || `https://${domain}/api/v2/`,
  };
};

export const getAuth0Thumbprint = async (_domain: string): Promise<string> => {
  // For testing, you can use this static thumbprint for Auth0
  // In production, you should fetch this dynamically from the JWKS endpoint
  return '9e99a48a9960b14926bb7e3b6e3f1c478a45c21b';
};
