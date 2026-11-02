// The Web player's movement: a port of the three.js demo's site/demo/core.ts,
// with the same numbers, so the two demos move alike. Plain C#, no UnityEngine,
// so tools/engines/unity-walk.test.ts compiles and checks it with Mono against
// the same cases as site/demo/demo.test.ts.
//
// Ground coordinates are x and z. Unity is left-handed: seen from above with
// +Z ahead, +X is to the RIGHT (three.js has it on the left), so the camera's
// right is (cos yaw, -sin yaw) here where core.ts has (-cos yaw, sin yaw).
// glTFast mirrors X on import, so a character facing +Z in the file faces +Z
// here too; a heading is the yaw round Y from +Z, as Quaternion.Euler takes it.

using System;

namespace Dramatis
{
    public struct Flat
    {
        public double x, z;
        public Flat(double x, double z) { this.x = x; this.z = z; }
    }

    public struct Pillar
    {
        public double x, z, r;
        public Pillar(double x, double z, double r) { this.x = x; this.z = z; this.r = r; }
    }

    public struct Gait
    {
        public string name, clip;
        public double speed;
        public Gait(string name, string clip, double speed) { this.name = name; this.clip = clip; this.speed = speed; }
    }

    public static class Walk
    {
        /// <summary>The clips the demo plays, slowest first, from UAL volume 1's core.</summary>
        public static readonly Gait[] Gaits =
        {
            new Gait("idle", "Idle_Loop", 0),
            new Gait("walk", "Walk_Loop", 1.4),
            new Gait("jog", "Jog_Fwd_Loop", 3.4),
            new Gait("sprint", "Sprint_Loop", 6),
        };

        /// <summary>The gait whose speed is nearest.</summary>
        public static Gait GaitFor(double speed)
        {
            var best = Gaits[0];
            foreach (var g in Gaits)
                if (Math.Abs(g.speed - speed) < Math.Abs(best.speed - speed)) best = g;
            return best;
        }

        /// <summary>
        /// The direction to move, from forward/back and right/left in -1..1 and
        /// the camera's yaw (its forward round Y from +Z). Unit length, or null.
        /// </summary>
        public static Flat? Steer(double forward, double right, double cameraYaw)
        {
            if (forward == 0 && right == 0) return null;
            double s = Math.Sin(cameraYaw), c = Math.Cos(cameraYaw);
            double x = forward * s + right * c;
            double z = forward * c - right * s;
            double len = Math.Sqrt(x * x + z * z);
            return new Flat(x / len, z / len);
        }

        /// <summary>The heading (yaw round Y from +Z, radians) facing along a direction.</summary>
        public static double HeadingOf(Flat dir) => Math.Atan2(dir.x, dir.z);

        /// <summary>Turn toward a heading by at most maxStep radians, the short way.</summary>
        public static double TurnToward(double current, double target, double maxStep)
        {
            double d = target - current;
            d = Math.Atan2(Math.Sin(d), Math.Cos(d));
            if (Math.Abs(d) <= maxStep) return current + d;
            return current + Math.Sign(d) * maxStep;
        }

        /// <summary>Where a clicked destination leads: a unit direction, or null on arrival.</summary>
        public static Flat? TowardGoal(Flat at, Flat goal, double arrive = 0.15)
        {
            double x = goal.x - at.x, z = goal.z - at.z;
            double len = Math.Sqrt(x * x + z * z);
            if (len <= arrive) return null;
            return new Flat(x / len, z / len);
        }

        /// <summary>Keep a walker of radius r out of the pillars and inside the square arena.</summary>
        public static Flat Collide(Flat at, double r, Pillar[] pillars, double half)
        {
            double x = at.x, z = at.z;
            foreach (var p in pillars)
            {
                double dx = x - p.x, dz = z - p.z;
                double d = Math.Sqrt(dx * dx + dz * dz);
                double min = p.r + r;
                if (d >= min) continue;
                if (d < 1e-6) { x = p.x + min; continue; }
                x = p.x + dx / d * min;
                z = p.z + dz / d * min;
            }
            double edge = half - r;
            return new Flat(Math.Max(-edge, Math.Min(edge, x)), Math.Max(-edge, Math.Min(edge, z)));
        }

        /// <summary>The props: a ring of pillars, as core.ts's pillarRing (8 at 7 m).</summary>
        public static Pillar[] PillarRing(int count = 8, double radius = 7)
        {
            var ring = new Pillar[count];
            for (int i = 0; i < count; i++)
            {
                double a = (double)i / count * Math.PI * 2 + Math.PI / count;
                ring[i] = new Pillar(Math.Sin(a) * radius, Math.Cos(a) * radius, 0.35 + (i % 3) * 0.15);
            }
            return ring;
        }

        /// <summary>A pillar's height, as the three.js demo draws it.</summary>
        public static double PillarHeight(int i) => 1 + (i % 4) * 0.6;
    }
}
