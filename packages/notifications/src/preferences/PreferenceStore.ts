export interface UserPreferences {
  userId: string;
  disabledChannels: string[]; // e.g. ['push', 'sms']
  optedOutTopics: string[]; // e.g. ['marketing', 'matching-waves']
}

export interface INotificationPreferenceStore {
  getPreferences(userId: string): Promise<UserPreferences>;
  setPreferences(userId: string, preferences: UserPreferences): Promise<void>;
  isAllowed(userId: string, channel: string, topic?: string): Promise<boolean>;
}

export class InMemoryPreferenceStore implements INotificationPreferenceStore {
  private store = new Map<string, UserPreferences>();

  public async getPreferences(userId: string): Promise<UserPreferences> {
    const prefs = this.store.get(userId);
    if (prefs) return prefs;

    return {
      userId,
      disabledChannels: [],
      optedOutTopics: [],
    };
  }

  public async setPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    this.store.set(userId, preferences);
  }

  public async isAllowed(userId: string, channel: string, topic?: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId);
    
    // Check if the overall channel (e.g. 'push') is disabled for this user
    if (prefs.disabledChannels.includes(channel)) {
      return false;
    }

    // Check if the user is opted out of the topic
    if (topic && prefs.optedOutTopics.includes(topic)) {
      return false;
    }

    return true;
  }
}
