const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*", // In production, replace with your frontend URL
    methods: ["GET", "POST"],
  },
})

// Store for active users
const activeUsers = new Map()
// Store for user pairs
const userPairs = new Map()
// Store for users waiting to be matched
let waitingUsers = []

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Add user to active users
  activeUsers.set(socket.id, { socket })

  // User is looking for a match
  socket.on("find-match", () => {
    console.log(`User ${socket.id} is looking for a match`)

    // Remove user from waiting list if they're already there
    waitingUsers = waitingUsers.filter((id) => id !== socket.id)

    // Check if user is already paired
    if (userPairs.has(socket.id)) {
      const pairedUserId = userPairs.get(socket.id)
      // Notify the paired user that this user has left
      if (activeUsers.has(pairedUserId)) {
        activeUsers.get(pairedUserId).socket.emit("user-disconnected")
      }
      // Remove the pair
      userPairs.delete(socket.id)
      userPairs.delete(pairedUserId)
    }

    // If there are users waiting, match with the first one
    if (waitingUsers.length > 0) {
      const matchedUserId = waitingUsers.shift()

      // Create a pair
      userPairs.set(socket.id, matchedUserId)
      userPairs.set(matchedUserId, socket.id)

      // Notify both users that they've been matched
      socket.emit("matched")
      if (activeUsers.has(matchedUserId)) {
        activeUsers.get(matchedUserId).socket.emit("matched")
      }

      console.log(`Matched ${socket.id} with ${matchedUserId}`)
    } else {
      // Add user to waiting list
      waitingUsers.push(socket.id)
    }
  })

  // Handle WebRTC signaling
  socket.on("offer", (offer) => {
    const pairedUserId = userPairs.get(socket.id)
    if (pairedUserId && activeUsers.has(pairedUserId)) {
      activeUsers.get(pairedUserId).socket.emit("offer", offer)
    }
  })

  socket.on("answer", (answer) => {
    const pairedUserId = userPairs.get(socket.id)
    if (pairedUserId && activeUsers.has(pairedUserId)) {
      activeUsers.get(pairedUserId).socket.emit("answer", answer)
    }
  })

  socket.on("ice-candidate", (candidate) => {
    const pairedUserId = userPairs.get(socket.id)
    if (pairedUserId && activeUsers.has(pairedUserId)) {
      activeUsers.get(pairedUserId).socket.emit("ice-candidate", candidate)
    }
  })

  // Handle chat messages
  socket.on("chat-message", (message) => {
    const pairedUserId = userPairs.get(socket.id)
    if (pairedUserId && activeUsers.has(pairedUserId)) {
      activeUsers.get(pairedUserId).socket.emit("chat-message", message)
    }
  })

  // User wants to leave the chat
  socket.on("leave-chat", () => {
    if (userPairs.has(socket.id)) {
      const pairedUserId = userPairs.get(socket.id)
      // Notify the paired user that this user has left
      if (activeUsers.has(pairedUserId)) {
        activeUsers.get(pairedUserId).socket.emit("user-disconnected")
      }
      // Remove the pair
      userPairs.delete(socket.id)
      userPairs.delete(pairedUserId)
    }

    // Remove from waiting list
    waitingUsers = waitingUsers.filter((id) => id !== socket.id)
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`)

    // If user was paired, notify the other user
    if (userPairs.has(socket.id)) {
      const pairedUserId = userPairs.get(socket.id)
      if (activeUsers.has(pairedUserId)) {
        activeUsers.get(pairedUserId).socket.emit("user-disconnected")
      }
      // Remove the pair
      userPairs.delete(socket.id)
      userPairs.delete(pairedUserId)
    }

    // Remove from active users
    activeUsers.delete(socket.id)

    // Remove from waiting list
    waitingUsers = waitingUsers.filter((id) => id !== socket.id)
  })
})

// Route to check if server is running
app.get("/", (req, res) => {
  res.send("Socket.io server for Random Video Chat is running!")
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

