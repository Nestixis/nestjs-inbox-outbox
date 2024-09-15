
export const createMockedInboxOutboxEventProcessor = () => {
    return {
        process: jest.fn(),
    }
}