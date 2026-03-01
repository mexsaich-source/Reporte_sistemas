const defaultInventory = [
    { id: 'DEV-8920', type: 'Laptop', model: 'Dell Latitude 7420', user: 'Ana Silva', department: 'Recursos Humanos', status: 'Active', warranty: '2025-11-20', condition: 'Bueno' }
];

const STORAGE_KEY = 'mexsa_inventory';

const initializeStorage = () => {
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultInventory));
    }
};

export const inventoryService = {

    async getAll() {
        initializeStorage();
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
                resolve(data);
            }, 600);
        });
    },

    async add(item) {
        initializeStorage();
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
                const newItem = {
                    ...item,
                    id: item.id || `DEV-${Math.floor(1000 + Math.random() * 9000)}`
                };
                const updatedData = [newItem, ...data];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
                resolve(newItem);
            }, 800);
        });
    },

    async update(id, updates) {
        initializeStorage();
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
                const updatedData = data.map(item =>
                    item.id === id ? { ...item, ...updates } : item
                );
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
                resolve(true);
            }, 600);
        });
    },

    async remove(id) {
        initializeStorage();
        return new Promise((resolve) => {
            setTimeout(() => {
                const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
                const updatedData = data.filter(item => item.id !== id);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
                resolve(true);
            }, 500);
        });
    }
};
