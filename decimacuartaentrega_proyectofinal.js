const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');

mongoose.connect('mongodb://localhost:27017/your_database', { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  documents: [{ name: String, reference: String }],
  last_connection: Date // Add last_connection field to user schema
});

const User = mongoose.model('User', userSchema);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json());
app.use(session({ secret: 'tu_secreto', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = '';
    if (file.fieldname === 'profileImage') {
      uploadPath = './uploads/profiles';
    } else if (file.fieldname === 'productImage') {
      uploadPath = './uploads/products';
    } else {
      uploadPath = './uploads/documents';
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage: storage });


app.post('/api/users/:uid/documents', upload.array('documents'), async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    req.files.forEach(file => {
      user.documents.push({ name: file.originalname, reference: file.path });
    });

    await user.save();
    res.status(200).json({ message: 'Documentos subidos exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


app.put('/api/users/premium/:uid', async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

  
    const requiredDocuments = ['Identificación', 'Comprobante de domicilio', 'Comprobante de estado de cuenta'];
    const uploadedDocuments = user.documents.map(doc => doc.name);
    const isDocumentsUploaded = requiredDocuments.every(doc => uploadedDocuments.includes(doc));
    
    if (!isDocumentsUploaded) {
      return res.status(400).json({ message: 'El usuario no ha terminado de procesar su documentación' });
    }

 
    user.premium = true;
    await user.save();

    res.status(200).json({ message: 'Usuario actualizado a premium exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }


    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }


    user.last_connection = new Date();
    await user.save();


    const token = jwt.sign({ userId: user._id }, 'your_secret_key');
    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const port = 8080;

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
