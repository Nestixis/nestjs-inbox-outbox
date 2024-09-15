
const createMockedDriverFactory = (driver) => {
    return {
        create: () => driver
    };
}

export {
    createMockedDriverFactory
};


