import { Inject, Injectable } from "@nestjs/common";
import { InboxOutboxModuleEventOptions, InboxOutboxModuleOptions, MODULE_OPTIONS_TOKEN } from "../inbox-outbox.module-definition";

@Injectable()
export class EventConfigurationResolver {

    private readonly eventConfigurationsMap: Map<string, InboxOutboxModuleEventOptions> = new Map();
    
    private isBuilt = false;

    constructor(@Inject(MODULE_OPTIONS_TOKEN) private options: InboxOutboxModuleOptions) {}

    resolve(eventName: string) : InboxOutboxModuleEventOptions {
        if (!this.isBuilt) {
            this.options.events.forEach(event => {
                this.eventConfigurationsMap.set(event.name, event);
            });
            this.isBuilt = true;
        }

        const config = this.eventConfigurationsMap.get(eventName);
        if (!config) {
            throw new Error(`Event configuration not found for event: ${eventName}`);
        }
        return config;
    }
}