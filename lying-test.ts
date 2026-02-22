export class UserService {
    private users = [];

    // Lying function: 'is' should be a pure check, but here it mutates.
    isUserValid(user: any) {
        if (!user) {
            this.users.pop(); // Mutation in a getter!
            return false;
        }
        return true;
    }

    // Another lying function: 'get' should not delete.
    getUserData(id: string) {
        this.cache.delete(id); // Mutation in a getter!
        return this.users.find(u => u.id === id);
    }
}
