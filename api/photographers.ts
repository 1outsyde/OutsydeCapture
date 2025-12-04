import { apiGet } from "./client";

export async function fetchPhotographers() {
  return apiGet("/api/photographers");
}
