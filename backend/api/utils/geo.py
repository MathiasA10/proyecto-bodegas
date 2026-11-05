from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1, lon1, lat2, lon2):
    """Distancia en kilometros entre dos coordenadas (o None si son invalidas)."""
    try:
        lat1, lon1, lat2, lon2 = (float(value) for value in (lat1, lon1, lat2, lon2))
    except (TypeError, ValueError):
        return None

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    a = min(1.0, max(0.0, a))

    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))
