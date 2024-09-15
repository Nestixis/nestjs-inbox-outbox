export const createMockedDriver = () => {
    return {
        persist: jest.fn(),
        remove: jest.fn(),
        flush: jest.fn(),
        createInboxOutboxTransportEvent: jest.fn(),
        findAndExtendReadyToRetryEvents: jest.fn()
    }
}