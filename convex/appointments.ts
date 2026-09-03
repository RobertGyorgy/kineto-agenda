// @ts-nocheck
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const wrapUpSession = mutation({
  args: {
    appointmentId: v.id("appointments"),
    notes: v.string(),
    rebookForNextWeek: v.boolean(),
  },
  handler: async (ctx, args) => {
    // 1. Mark current appointment as complete and save notes
    // await ctx.db.patch(args.appointmentId, { status: "completed", notes: args.notes });

    // 2. If rebookForNextWeek is true, get the appointment details
    if (args.rebookForNextWeek) {
      // const appointment = await ctx.db.get(args.appointmentId);
      // if (appointment) {
      //   const nextWeek = new Date(appointment.startTime);
      //   nextWeek.setDate(nextWeek.getDate() + 7);
      //   await ctx.db.insert("appointments", {
      //     patientId: appointment.patientId,
      //     startTime: nextWeek.toISOString(),
      //     location: appointment.location,
      //     status: "scheduled"
      //   });
      // }
    }
  },
});

export const createAppointment = mutation({
  args: {
    patientId: v.id("patients"),
    startTime: v.string(),
    location: v.union(v.literal("Ghimbav"), v.literal("Belaqua")),
  },
  handler: async (ctx, args) => {
    // await ctx.db.insert("appointments", {
    //   patientId: args.patientId,
    //   startTime: args.startTime,
    //   location: args.location,
    //   status: "scheduled"
    // });
  },
});
