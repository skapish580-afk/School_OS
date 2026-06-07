from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
import logging

logger = logging.getLogger(__name__)

def geocode_address(address_text):
    """
    Geocodes a text address to (latitude, longitude) using Nominatim.
    Appends 'India' to help with precision.
    """
    if not address_text:
        return None, None
        
    try:
        # Append country for better results if not already there
        if "India" not in address_text:
            address_text += ", India"
            
        geolocator = Nominatim(user_agent="school_os_transport_system_v2")
        location = geolocator.geocode(address_text, timeout=10, addressdetails=True)
        
        if location:
            # Prefer higher resolution results
            return location.latitude, location.longitude
        return None, None
    except (GeocoderTimedOut, GeocoderServiceError) as e:
        logger.error(f"Geocoding error for address '{address_text}': {e}")
        return None, None
    except Exception as e:
        logger.error(f"Unexpected error during geocoding: {e}")
        return None, None
