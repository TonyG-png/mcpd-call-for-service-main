/**
 * Dataset Configuration
 * 
 * To point this app at a different Socrata dataset:
 * 1. Change `domain` to the Socrata host (e.g., "data.cityofchicago.org")
 * 2. Change `datasetId` to the dataset's 4x4 identifier
 * 3. Optionally provide `fieldOverrides` to manually map semantic fields
 *    to actual column names if automatic discovery doesn't work.
 */

export interface DatasetConfig {
  /** Socrata domain host */
  domain: string;
  /** Socrata dataset 4x4 identifier */
  datasetId: string;
  /** Display title for the dashboard */
  title: string;
  /** Max records to fetch per request */
  defaultLimit: number;
  /**
   * Optional manual field overrides. Keys are semantic names
   * (incidentId, startTime, endTime, callType, priority, district,
   *  beat, address, city, latitude, longitude, serviceCategory).
   * Values are actual Socrata column fieldNames.
   */
  fieldOverrides?: Record<string, string>;
}

export const defaultConfig: DatasetConfig = {
  domain: "data.montgomerycountymd.gov",
  datasetId: "98cc-bc7d",
  title: "Montgomery County Police Calls for Service Dashboard",
  defaultLimit: 5000,
  fieldOverrides: {
    beat: "sector",
  },
};
