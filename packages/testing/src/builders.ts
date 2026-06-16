export interface MockLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface MockDriver {
  id: string;
  tenantId: string;
  status: "OFFLINE" | "AVAILABLE" | "BUSY" | "STALE";
  location: MockLocation;
  capabilities: string[];
}

export interface MockRider {
  id: string;
  tenantId: string;
  name: string;
  rating: number;
}

export interface MockTrip {
  id: string;
  tenantId: string;
  riderId: string;
  driverId?: string;
  status:
    | "REQUESTED"
    | "ASSIGNING"
    | "ACCEPTED"
    | "EN_ROUTE"
    | "ARRIVED"
    | "STARTED"
    | "COMPLETED"
    | "CANCELLED";
  pickup: { latitude: number; longitude: number; address: string };
  destination: { latitude: number; longitude: number; address: string };
  createdAt: number;
}

export class DriverBuilder {
  private driver: MockDriver = {
    id: "driver-123",
    tenantId: "tenant-default",
    status: "AVAILABLE",
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      timestamp: Date.now(),
    },
    capabilities: ["sedan", "vip"],
  };

  public withId(id: string): this {
    this.driver.id = id;
    return this;
  }

  public withTenantId(tenantId: string): this {
    this.driver.tenantId = tenantId;
    return this;
  }

  public withStatus(status: MockDriver["status"]): this {
    this.driver.status = status;
    return this;
  }

  public withLocation(lat: number, lng: number): this {
    this.driver.location = {
      latitude: lat,
      longitude: lng,
      timestamp: Date.now(),
    };
    return this;
  }

  public withCapabilities(capabilities: string[]): this {
    this.driver.capabilities = capabilities;
    return this;
  }

  public build(): MockDriver {
    return { ...this.driver, location: { ...this.driver.location } };
  }
}

export class RiderBuilder {
  private rider: MockRider = {
    id: "rider-123",
    tenantId: "tenant-default",
    name: "Jane Doe",
    rating: 4.9,
  };

  public withId(id: string): this {
    this.rider.id = id;
    return this;
  }

  public withTenantId(tenantId: string): this {
    this.rider.tenantId = tenantId;
    return this;
  }

  public withName(name: string): this {
    this.rider.name = name;
    return this;
  }

  public build(): MockRider {
    return { ...this.rider };
  }
}

export class TripBuilder {
  private trip: MockTrip = {
    id: "trip-123",
    tenantId: "tenant-default",
    riderId: "rider-123",
    status: "REQUESTED",
    pickup: { latitude: 37.7749, longitude: -122.4194, address: "Market St" },
    destination: {
      latitude: 37.7849,
      longitude: -122.4094,
      address: "Union Square",
    },
    createdAt: Date.now(),
  };

  public withId(id: string): this {
    this.trip.id = id;
    return this;
  }

  public withTenantId(tenantId: string): this {
    this.trip.tenantId = tenantId;
    return this;
  }

  public withRiderId(riderId: string): this {
    this.trip.riderId = riderId;
    return this;
  }

  public withDriverId(driverId: string): this {
    this.trip.driverId = driverId;
    return this;
  }

  public withStatus(status: MockTrip["status"]): this {
    this.trip.status = status;
    return this;
  }

  public withLocations(
    pickup: { lat: number; lng: number },
    dest: { lat: number; lng: number }
  ): this {
    this.trip.pickup = {
      ...this.trip.pickup,
      latitude: pickup.lat,
      longitude: pickup.lng,
    };
    this.trip.destination = {
      ...this.trip.destination,
      latitude: dest.lat,
      longitude: dest.lng,
    };
    return this;
  }

  public build(): MockTrip {
    return { ...this.trip };
  }
}
