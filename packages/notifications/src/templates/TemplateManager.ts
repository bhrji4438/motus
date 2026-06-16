export interface INotificationTemplate {
  id: string;
  titleTemplate: string;
  bodyTemplate: string;
  defaultData?: Record<string, string>;
}

export class TemplateManager {
  private templates = new Map<string, INotificationTemplate>();

  /**
   * Register a new notification template.
   */
  public register(template: INotificationTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Retrieve a template by ID.
   */
  public get(templateId: string): INotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Render a template's title and body using custom key-value variables.
   */
  public render(
    templateId: string,
    variables: Record<string, string>
  ): { title: string; body: string } {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Notification template '${templateId}' not found`);
    }

    const mergedData = { ...template.defaultData, ...variables };

    const title = this.interpolate(template.titleTemplate, mergedData);
    const body = this.interpolate(template.bodyTemplate, mergedData);

    return { title, body };
  }

  private interpolate(tmpl: string, data: Record<string, string>): string {
    return tmpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return key in data ? data[key] : match;
    });
  }
}
