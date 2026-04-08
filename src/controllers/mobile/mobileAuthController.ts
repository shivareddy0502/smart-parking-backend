import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        role: 'HOST', // Default to host so they can have spots
        activeRole: 'DRIVER',
      },
    });

    const token = jwt.sign({ sub: user.id, userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    // --- SEED DEMO DATA ---
    try {
        // 1. Ensure a "Demo Host" exists for some spots
        let demoHost = await prisma.user.findUnique({ where: { email: 'demo-host@parkspot.com' } });
        if (!demoHost) {
            demoHost = await prisma.user.create({
                data: {
                    email: 'demo-host@parkspot.com',
                    passwordHash: await bcrypt.hash('password123', 10),
                    name: 'Demo System Host',
                    role: 'HOST'
                }
            });
        }

        // 2. Create 5 spots
        // 2 owned by the new user
        await prisma.spot.create({
            data: {
                title: 'My Home Driveway',
                location: 'Indiranagar, Bangalore',
                latitude: 12.9784,
                longitude: 77.6408,
                rate: 40,
                pricePerDay: 350,
                capacity: 'FOUR_WHEELER',
                hostId: user.id,
                photos: ['https://images.unsplash.com/photo-1590674867571-096e2cc7617b']
            }
        });
        const userSpot2 = await prisma.spot.create({
            data: {
                title: 'Office Extra Space',
                location: 'Whitefield, Bangalore',
                latitude: 12.9698,
                longitude: 77.7499,
                rate: 30,
                pricePerDay: 250,
                capacity: 'TWO_WHEELER',
                hostId: user.id,
                photos: ['https://images.unsplash.com/photo-1506521781263-d8422e82f27a']
            }
        });

        // 3 by others
        await prisma.spot.create({
            data: {
                title: 'Koramangala Premium',
                location: 'Koramangala 4th Block',
                latitude: 12.9339,
                longitude: 77.6321,
                rate: 60,
                pricePerDay: 500,
                capacity: 'FOUR_WHEELER',
                hostId: demoHost.id,
            }
        });
        await prisma.spot.create({
            data: {
                title: 'HSR Layout Spot',
                location: 'Sector 2, HSR',
                latitude: 12.9128,
                longitude: 77.6388,
                rate: 35,
                pricePerDay: 300,
                capacity: 'FOUR_WHEELER',
                hostId: demoHost.id,
            }
        });
        const targetSpot = await prisma.spot.create({
            data: {
                title: 'MG Road Secure',
                location: 'MG Road Metro',
                latitude: 12.9756,
                longitude: 77.6067,
                rate: 50,
                pricePerDay: 450,
                capacity: 'FOUR_WHEELER',
                hostId: demoHost.id,
            }
        });

        // 3. One pending booking from "Arjun Nair" for the new user's spot
        let arjun = await prisma.user.findUnique({ where: { email: 'arjun@demo.com' } });
        if (!arjun) {
            arjun = await prisma.user.create({
                data: {
                    email: 'arjun@demo.com',
                    passwordHash: await bcrypt.hash('password123', 10),
                    name: 'Arjun Nair',
                    role: 'GUEST'
                }
            });
        }
        await prisma.booking.create({
            data: {
                startTime: new Date(Date.now() + 86400000), // tomorrow
                endTime: new Date(Date.now() + 86400000 + 7200000), // 2 hours later
                totalAmount: 60,
                status: 'PENDING',
                spotId: userSpot2.id,
                guestId: arjun.id,
                driverName: 'Arjun Nair',
                spotTitle: userSpot2.title,
                spotAddress: userSpot2.location
            }
        });

        // 4. One confirmed booking where user is the driver
        const confirmedBooking = await prisma.booking.create({
            data: {
                startTime: new Date(Date.now() - 3600000), // 1 hour ago
                endTime: new Date(Date.now() + 3600000), // 1 hour later
                totalAmount: 100,
                status: 'CONFIRMED',
                spotId: targetSpot.id,
                guestId: user.id,
                driverName: user.name,
                spotTitle: targetSpot.title,
                spotAddress: targetSpot.location,
                digitalKey: {
                    create: {
                        payload: 'PSK-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
                        expiresAt: new Date(Date.now() + 7200000)
                    }
                }
            }
        });

        // 5. One transaction record
        await prisma.transaction.create({
            data: {
                amount: 100,
                type: 'PAYMENT',
                status: 'COMPLETED',
                userId: user.id,
                bookingId: confirmedBooking.id,
                spotTitle: targetSpot.title
            }
        });

    } catch (e) {
        console.error("Failed to seed demo data for new user", e);
        // Continue even if seeding fails
    }

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        activeRole: user.activeRole.toLowerCase(),
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ sub: user.id, userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        activeRole: user.activeRole.toLowerCase(),
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
};
