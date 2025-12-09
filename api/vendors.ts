import { apiGet } from "./client";

/**
 * GET all vendors → expects backend routes:
 *   GET /api/businesses
 */
export async function fetchVendors() {
  try {
    const res = await apiGet("/api/businesses");

    // Normalize response:
    // backend may return:
    // { businesses: [...] } OR { data: [...] } OR [...]
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.businesses)) return res.businesses;
    if (Array.isArray(res.data)) return res.data;

    return [];
  } catch (err) {
    console.error("❌ Failed to fetch vendors:", err);
    throw err;
  }
}

/**
 * GET a single vendor by ID → expects:
 *   GET /api/businesses/:id
 */
export async function fetchVendorById(vendorId: string | number) {
  try {
    const res = await apiGet(`/api/businesses/${vendorId}`);

    // Normalize vendor shape
    if (res?.business) return res.business;
    if (res?.data) return res.data;
    if (res?.id) return res;

    return null;
  } catch (err) {
    console.error(`❌ Failed to fetch vendor ${vendorId}:`, err);
    throw err;
  }
}
