/**
 * Single source of truth for runtime configuration constants.
 *
 * PI_SERVER — base URL of the Raspberry Pi access point + HTTP server.
 *   Field network (Pi acts as Wi-Fi AP, SSID `E-ink`): http://192.168.4.1:5050
 *   Home dev network (Pi attached to home Wi-Fi):      http://192.168.86.193:5050
 *
 * Switch this constant for the target build. Dynamic per-environment
 * resolution is intentionally not implemented yet.
 */
export const PI_SERVER = 'http://192.168.86.193:5050';
