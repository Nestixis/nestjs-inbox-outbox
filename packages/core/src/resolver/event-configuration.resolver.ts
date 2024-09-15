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

        return this.eventConfigurationsMap.get(eventName);
    }
}