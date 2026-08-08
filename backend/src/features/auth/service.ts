import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User, AuthPayload, Role } from './domain';
import { UserRepository } from './repository';
import { registerInputSchema, loginInputSchema } from './schemas';

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
  ) {}

  async register(input: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const validated = registerInputSchema.parse(input);

    const existing = await this.userRepository.findByEmail(validated.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);
    const userCount = await this.userRepository.count();
    const role: Role = userCount === 0 ? 'ADMIN' : 'USER';

    return this.userRepository.create({
      email: validated.email,
      name: validated.name,
      passwordHash,
      role,
    });
  }

  async login(input: { email: string; password: string }): Promise<AuthPayload> {
    const validated = loginInputSchema.parse(input);

    const user = await this.userRepository.findByEmailWithHash(
      validated.email,
    );
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const valid = await bcrypt.compare(validated.password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    const { passwordHash: _, ...publicUser } = user;
    return {
      token: this.issueToken(publicUser),
      user: publicUser,
    };
  }

  issueToken(user: User): string {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn as SignOptions['expiresIn'] },
    );
  }

  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as {
        sub: string;
      };
      return this.userRepository.findById(decoded.sub);
    } catch {
      return null;
    }
  }
}
