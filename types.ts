
export enum AppStatus {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface HotelReport {
  basic_info: {
    hotel_name: string;
    city: string;
    segment: string;
    micro_market?: string;
    property_style: string;
    overview_description: string;
    year_built?: string;
  };
  ota_ratings: {
    google?: { score: number; count: number };
    makemytrip?: { score: number; count: number };
    goibibo?: { score: number; count: number };
    booking_com?: { score: number; count: number };
    agoda?: { score: number; count: number };
    treebo?: { score: number; count: number };
    easemytrip?: { score: number; count: number };
    yatra?: { score: number; count: number };
  };
  revenue_insights?: Array<{
    month: string;
    arr: number;
    occupancy: number;
  }>;
  amenities: {
    infinity_pool: boolean;
    gym: { available: boolean; open_time?: string; close_time?: string; equipment_quality?: string };
    ev_charging: { available: boolean; four_wheeler_count?: number; two_wheeler_count?: number };
    power_backup: { available: boolean; hours?: number; type?: string };
    wifi_access: string;
    recreational_center: string;
    laundry_service?: boolean;
    room_service_24h?: boolean;
  };
  banquet_and_conference: {
    conference_halls: Array<{
      name: string;
      style: string;
      capacity: number;
      floor: string;
      wifi: boolean;
      washroom_available: boolean;
    }>;
    banquet_halls: Array<{
      name: string;
      capacity: number;
      floor: string;
      washroom_gender_separated: boolean;
      ac_available: boolean;
    }>;
    events: {
      dj_available: boolean;
      live_music: boolean;
      bonfire: { available: boolean; charges?: string };
      candle_light_dinner: { available: boolean; charges?: string };
    };
  };
  room_details: {
    categories: Array<{
      name: string;
      size_sqft?: string;
      view_type?: string;
      flooring_type?: string;
      connected_rooms: boolean;
      amenities?: string[];
      cancellation_policy?: string;
      deposit_required?: boolean;
    }>;
    family_rooms: { available: boolean; count?: number; max_occupancy?: number };
    room_lock_type: string;
    extra_mattress_charges: string;
    total_inventory?: number;
  };
  dining: {
    pure_veg: boolean;
    homemade_food_request: boolean;
    restaurant_location: string;
    happy_hours: { available: boolean; timing?: string; discount?: string };
    liquor_allowed: boolean;
    breakfast_type?: string;
  };
  safety_and_structure: {
    elevator: { available: boolean; door_type: string; access_type?: string };
    cctv: { available: boolean; backup_14_days: boolean; entrance_cctv: boolean };
    fire_safety: { 
      extinguishers: boolean; 
      sprinklers_in_rooms: boolean; 
      sprinklers_in_common_areas: boolean; 
      safety_measures_in_rooms: boolean;
      fire_exit_plan: boolean 
    };
    security: { manned_24x7: boolean; lady_staff: boolean };
    doctor_on_call: boolean;
    first_aid: boolean;
  };
  location_intelligence: {
    business_hubs: Array<{ name: string; distance: string }>;
    tourist_spots?: Array<{ name: string; distance: string }>;
    airport_transfer: { available: boolean; charges?: string };
    approach_type: string;
    parking_available: boolean;
  };
  external_links: {
    treebo_link?: string;
    mmt_link?: string;
    goibibo_link?: string;
    google_listing?: string;
    image_gallery?: string;
    easemytrip_link?: string;
    yatra_link?: string;
  };
  negative_points: string[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}
