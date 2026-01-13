
import { GoogleGenAI } from "@google/genai";
import { HotelReport, GroundingSource } from "../types";

const DEFAULT_REPORT: HotelReport = {
  basic_info: {
    hotel_name: "N/A",
    city: "N/A",
    segment: "N/A",
    property_style: "N/A",
    overview_description: "N/A"
  },
  ota_ratings: {},
  revenue_insights: [],
  amenities: {
    infinity_pool: false,
    gym: { available: false },
    ev_charging: { available: false },
    power_backup: { available: false },
    wifi_access: "N/A",
    recreational_center: "N/A"
  },
  banquet_and_conference: {
    conference_halls: [],
    banquet_halls: [],
    events: { dj_available: false, live_music: false, bonfire: { available: false }, candle_light_dinner: { available: false } }
  },
  room_details: {
    categories: [],
    family_rooms: { available: false },
    room_lock_type: "N/A",
    extra_mattress_charges: "N/A"
  },
  dining: {
    pure_veg: false,
    homemade_food_request: false,
    restaurant_location: "N/A",
    happy_hours: { available: false },
    liquor_allowed: false
  },
  safety_and_structure: {
    elevator: { available: false, door_type: "N/A", access_type: "N/A" },
    cctv: { available: false, backup_14_days: false, entrance_cctv: false },
    fire_safety: { 
      extinguishers: false, 
      sprinklers_in_rooms: false, 
      sprinklers_in_common_areas: false,
      safety_measures_in_rooms: false,
      fire_exit_plan: false 
    },
    security: { manned_24x7: false, lady_staff: false },
    doctor_on_call: false,
    first_aid: false
  },
  location_intelligence: {
    business_hubs: [],
    airport_transfer: { available: false },
    approach_type: "N/A",
    parking_available: false
  },
  external_links: {}
};

export const fetchHotelReport = async (hotelName: string, city: string): Promise<{ data: HotelReport; sources: GroundingSource[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    TASK: Generate an exhaustive property intelligence report for "${hotelName}" in "${city}", India.
    
    CRITICAL INSTRUCTION: You MUST fetch and synthesize data from ALL platforms where this hotel is listed. 
    This includes but is not limited to Google Search, MakeMyTrip, Goibibo, Booking.com, Agoda, and Treebo.com.
    
    REVENUE INTELLIGENCE PROTOCOL:
    1. HISTORICAL PERFORMANCE: Research or estimate (based on pricing trends, seasonal demand, and listed room inventory) the performance for the LAST 6 MONTHS.
    2. KEY METRICS: For each of the last 6 months, provide:
       - ARR (Average Room Rate) in INR.
       - Occupancy Percentage (%).
    
    SEARCH GROUNDING PROTOCOL:
    1. SCRAPE RATINGS: Provide specific score and review count for Google and EVERY major OTA.
    2. FIND LINKS: Extract direct URLs for MMT, Goibibo, Booking, Agoda, and Treebo.
    3. CROSS-VERIFY AMENITIES: Confirm Power Backup type, 24/7 Security, Fire Safety measures, and Elevator type.
    4. ROOM INVENTORY: Identify categories (Acacia, Oak, Maple, Mahogany) with precise sizes and view types.
    
    OUTPUT: Return ONLY a valid JSON object. No pre-amble.

    REQUIRED JSON STRUCTURE:
    {
      "basic_info": { "hotel_name", "city", "segment", "micro_market", "property_style", "overview_description", "year_built" },
      "ota_ratings": {
        "google": { "score", "count" },
        "makemytrip": { "score", "count" },
        "goibibo": { "score", "count" },
        "booking_com": { "score", "count" },
        "agoda": { "score", "count" },
        "treebo": { "score", "count" },
        "easemytrip": { "score", "count" },
        "yatra": { "score", "count" }
      },
      "revenue_insights": [
        { "month": string, "arr": number, "occupancy": number }
      ],
      "amenities": { "infinity_pool": boolean, "gym": { "available": boolean, "open_time", "close_time", "equipment_quality" }, "ev_charging": { "available": boolean, "four_wheeler_count", "two_wheeler_count" }, "power_backup": { "available": boolean, "hours", "type" }, "wifi_access", "recreational_center", "laundry_service": boolean, "room_service_24h": boolean },
      "banquet_and_conference": { "conference_halls": [{"name", "style", "capacity", "floor", "wifi": boolean, "washroom_available": boolean}], "banquet_halls": [{"name", "capacity", "floor", "washroom_gender_separated": boolean, "ac_available": boolean}], "events": { "dj_available": boolean, "live_music": boolean, "bonfire": { "available": boolean, "charges" }, "candle_light_dinner": { "available": boolean, "charges" } } },
      "room_details": { "categories": [{"name", "size_sqft", "view_type", "flooring_type", "connected_rooms": boolean, "amenities": string[], "cancellation_policy", "deposit_required": boolean}], "family_rooms": { "available": boolean, "count", "max_occupancy" }, "room_lock_type", "extra_mattress_charges", "total_inventory": number },
      "dining": { "pure_veg": boolean, "homemade_food_request": boolean, "restaurant_location", "happy_hours": { "available": boolean, "timing", "discount" }, "liquor_allowed": boolean, "breakfast_type" },
      "safety_and_structure": { "elevator": { "available": boolean, "door_type", "access_type" }, "cctv": { "available": boolean, "backup_14_days": boolean, "entrance_cctv": boolean }, "fire_safety": { "extinguishers": boolean, "sprinklers_in_rooms": boolean, "sprinklers_in_common_areas": boolean, "safety_measures_in_rooms": boolean, "fire_exit_plan": boolean }, "security": { "manned_24x7": boolean, "lady_staff": boolean }, "doctor_on_call": boolean, "first_aid": boolean },
      "location_intelligence": { "business_hubs": [{"name", "distance"}], "tourist_spots": [{"name", "distance"}], "airport_transfer": { "available": boolean, "charges" }, "approach_type", "parking_available": boolean },
      "external_links": { "treebo_link", "mmt_link", "goibibo_link", "google_listing", "image_gallery", "easemytrip_link", "yatra_link" }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      },
    });

    const text = response.text || "";
    let cleanJson = text;
    
    const extractJson = (str: string) => {
      const first = str.indexOf('{');
      const last = str.lastIndexOf('}');
      if (first !== -1 && last !== -1) return str.substring(first, last + 1);
      return str;
    };
    
    cleanJson = extractJson(cleanJson);
    const parsedData = JSON.parse(cleanJson);

    const merge = (target: any, source: any) => {
      for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
          Object.assign(source[key], merge(target[key], source[key]));
        }
      }
      return { ...target, ...source };
    };

    const finalData: HotelReport = merge(DEFAULT_REPORT, parsedData);
    finalData.basic_info.hotel_name = finalData.basic_info.hotel_name || hotelName;
    finalData.basic_info.city = finalData.basic_info.city || city;

    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri
          });
        }
      });
    }

    return { data: finalData, sources };
  } catch (error: any) {
    console.error("Gemini Multi-OTA Extraction Error:", error);
    throw new Error("Intelligence gathering failed. The hotel listing might be highly inconsistent across platforms. Please try again.");
  }
};
