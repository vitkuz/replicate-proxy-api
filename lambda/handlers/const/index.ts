
export const getDefaultsHeaders = (requestId: string) => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'X-Request-ID': requestId,
});
