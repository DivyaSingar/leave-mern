const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- MongoDB connection ----------
mongoose
  .connect("mongodb://127.0.0.1:27017/leavedb")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB error:", err.message));

// ---------- Model ----------
const Leave = mongoose.model(
  "Leave",
  new mongoose.Schema(
    {
      employeeName: { type: String, required: true },
      leaveType: {
        type: String,
        enum: ["Sick Leave", "Casual Leave", "Paid Leave", "Unpaid Leave"],
        required: true,
      },
      fromDate: { type: Date, required: true },
      toDate: { type: Date, required: true },
      reason: { type: String, required: true },
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
    },
    { timestamps: true }
  )
);

// ---------- Date validation helper ----------
// Dates yenar "YYYY-MM-DD" format madhe (input type="date" ne)
function isValidDateString(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str || "")) return false;
  const d = new Date(str);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

// ---------- APIs ----------

// Apply for leave
app.post("/leaves", async (req, res) => {
  const { employeeName, leaveType, fromDate, toDate, reason } = req.body;

  if (!employeeName || !leaveType || !fromDate || !toDate || !reason) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (fromDate < today) {
    return res.status(400).json({ message: "From date cannot be in the past" });
  }
  if (toDate < fromDate) {
    return res
      .status(400)
      .json({ message: "To date cannot be before From date" });
  }

  try {
    const leave = await Leave.create({
      employeeName: employeeName.trim(),
      leaveType,
      fromDate,
      toDate,
      reason: reason.trim(),
    });
    res.status(201).json({ message: "Leave applied successfully", leave });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all leaves (admin) - optional ?status=Pending ani ?employeeName=Rahul
app.get("/leaves", async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.employeeName) {
    filter.employeeName = new RegExp(`^${req.query.employeeName.trim()}$`, "i");
  }
  const leaves = await Leave.find(filter).sort({ createdAt: -1 });
  res.json(leaves);
});

// Approve / Reject (body: { status: "Approved" | "Rejected" })
app.put("/leaves/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!["Approved", "Rejected"].includes(status)) {
    return res
      .status(400)
      .json({ message: "Status must be Approved or Rejected" });
  }

  // Fakt Pending request chach status badalta yeto
  const leave = await Leave.findOneAndUpdate(
    { _id: req.params.id, status: "Pending" },
    { status },
    { new: true }
  );

  if (!leave) {
    const exists = await Leave.findById(req.params.id);
    if (!exists) return res.status(404).json({ message: "Leave not found" });
    return res
      .status(400)
      .json({ message: `Request is already ${exists.status}` });
  }
  res.json({ message: `Leave ${status} successfully`, leave });
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
