const express = require("express");
const fs = require("fs");

const path = require("path");
const session = require("express-session");

const app = express();

// ================= MIDDLEWARE =================

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

app.use(session({
    secret: "disease-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60,
        sameSite: "lax"
    }
}));

// ================= FILE PATHS =================

const DATA_FILE = path.join(__dirname, "data.json");
const USERS_FILE = path.join(__dirname, "users.json");

// ================= CREATE USERS FILE =================

if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]");
}

// ================= AUTH CHECK =================

function isAuthenticated(req, res, next) {

    if (req.session && req.session.user) {
        return next();
    }

    res.redirect("/login.html");
}

// ================= REGISTER =================

app.post("/register", (req, res) => {

    try {


        const {
            firstName,
            lastName,
            username,
            email,
            password,
            phone,
            address,
            dob,
            gender
        } = req.body;

        // Read existing users
        let users = [];

        if (fs.existsSync(USERS_FILE)) {

            users = JSON.parse(
                fs.readFileSync(USERS_FILE, "utf-8")
            );
        }

        // Add new user
        users.push({
            firstName,
            lastName,
            username,
            email,
            password,
            phone,
            address,
            dob,
            gender
        });

        // Save users
        fs.writeFileSync(
            USERS_FILE,
            JSON.stringify(users, null, 2)
        );

        res.json({
            success: true,
            message: "Registration Successful"
        });

    } catch (error) {

        console.log(error);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }

});

// ================= LOGIN =================

app.post("/login", (req, res) => {

    const { username, password } = req.body;

    let users = JSON.parse(fs.readFileSync(USERS_FILE));

    const validUser = users.find(
        user =>
            user.username === username &&
            user.password === password
    );

    if (validUser) {

        req.session.user = validUser;
        res.json({
            success: true
        });

    } else {

        res.json({
            success: false,
            message: "Invalid Username or Password"
        });
    }
});

// ================= LOGOUT =================

app.get("/logout", (req, res) => {

    req.session.destroy(err => {

        res.clearCookie("connect.sid");

        res.redirect("/login.html");
    });
});


// ================= GET USER =================

app.get("/user", (req, res) => {

    if (!req.session.user) {

        return res.status(401).json({
            success: false
        });
    }

    res.json({
        success: true,
        user: req.session.user
    });
});

// ================= STATIC FILES =================

app.use(express.static(path.join(__dirname, "public")));

// ================= DASHBOARD =================

app.get("/", isAuthenticated, (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "dashboard.html")
    );
});

app.get("/dashboard.html", isAuthenticated, (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "dashboard.html")
    );
});

// ================= DISEASE DATA =================

const data = JSON.parse(
    fs.readFileSync(DATA_FILE, "utf-8")
);

// ================= PREDICT =================

app.post("/predict", isAuthenticated, (req, res) => {

    if (!Array.isArray(req.body.symptoms)) {

        return res.status(400).json({
            error: "Request body must include a symptoms array."
        });
    }

    const userSymptoms = req.body.symptoms
        .map(s => String(s).toLowerCase())
        .filter(Boolean);

    const matches = [];

    for (const disease in data) {

        const symptoms = Array.isArray(data[disease])
            ? data[disease].map(
                s => String(s).toLowerCase()
            )
            : [];

        const matchedSymptoms = symptoms.filter(
            s => userSymptoms.includes(s)
        );

        const count = matchedSymptoms.length;

        if (count > 0) {

            const confidence = Math.round(
                (count / symptoms.length) * 100
            );

            let severity = "low";

            if (confidence >= 70) {
                severity = "high";
            } else if (confidence >= 40) {
                severity = "moderate";
            }

            matches.push({
                disease,
                confidence,
                severity,
                matchedSymptoms,
                description:
                    `The selected symptoms best match ${disease}.`
            });
        }
    }

    matches.sort(
        (a, b) => b.confidence - a.confidence
    );

    res.json({
        predictions: matches.slice(0, 3)
    });
});

// ================= START SERVER =================

app.listen(3000, () => {

    console.log(
        "Server running on http://localhost:3000"
    );
});