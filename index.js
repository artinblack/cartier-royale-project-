const express = require('express');
const session = require('express-session');
const app = express();
const cookieParser = require('cookie-parser');
const { QuickDB } = require('quick.db');
const db = new QuickDB({
    filePath: './database.sqlite'
});
const port = 5000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }))
app.use(session({
    secret: '4pOGPX5C6Wxs5YeAMImC0jk3iRBCIMQctJyoz4oz',
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 60000000 },
    rolling: true,
    name: 'session'
}));
// Use cookie to save session
app.use(cookieParser());
app.use(async (req, res, next) => {
    if (req.session.username && !req.cookies.username) {
        res.cookie('username', req.session.username, { maxAge: 60000000 });
    }

    if (!req.session.username && req.cookies.username) {
        req.session.username = req.cookies.username;
        let user = await db.get(`users.${req.session.username}`);
        req.session.email = user.email;
        req.session.admin = user.accountType === 'admin' ? true : false;
        req.session.seller = user.accountType === 'seller' ? true : false;
        req.session.save();
    }
    // console.log(req.session)
    next();
});

app.get('/', (req, res) => {
    res.redirect('/home')
});


app.get('/home', async (req, res) => {
    let stores = await db.get('stores') || false;
    // Get 3 random stores to display on home page
    let toSend = [];
    if (stores) {
        // Slice array to get first 3 elements
        toSend = stores.slice(0, 3);
    } else {
        toSend = false;
    }
    if (toSend.length > 0) {
        toSend = toSend.sort(() => 0.7 - 0.5);
    }
    res.render('home', { req: req, stores: toSend });
});


app.get('/login', (req, res) => {
    const username = req.session.username;
    if (username) {
        res.redirect('/home');
    } else {
        let error = req.query.error;
        let msg = false;
        if (error) {
            switch (error) {
                case '0':
                    msg = 'Account created successfully. Please login';
                    break;
                case '1':
                    msg = 'Invalid username or password';
                    break;
                default:
                    break;
            }
        }
        res.render('login', { msg, req: req });
    }
});

app.post('/login', async (req, res) => {
    const username = req.session.username;
    if (username) {
        res.redirect('/home');
    } else {
        const { username, password } = req.body;
        if (username) {
            let check = await db.get(`users.${username}`);
            if (check && check.password === password) {
                req.session.username = username;
                req.session.email = check.email;
                if (check.accountType == 'admin') {
                    req.session.admin = true;
                } else {
                    req.session.admin = false;
                }
                if (check.accountType == 'seller') {
                    req.session.seller = true;
                } else {
                    req.session.seller = false;
                }
                // Save session to cookie so user can stay logged in
                req.session.save();
                res.redirect('/home');
            } else {
                res.redirect('/login?error=1');
            }
        } else {
            res.redirect('/login?error=1');
        }
    }
});

app.get('/register', (req, res) => {
    const username = req.session.username;
    if (username) {
        res.redirect('/home');
    } else {
        let error = req.query.error;
        let msg = false;
        if (error) {
            switch (error) {
                case '0':
                    msg = 'Invalid username';
                    break;
                case '1':
                    msg = 'Username already exists';
                    break;
                case '2':
                    msg = 'Passwords do not match';
                    break;
                case '3':
                    msg = 'Password must be at least 6 characters long';
                    break;
                default:
                    break;
            }
        }
        res.render('register', { msg, req: req });
    }
});

app.post('/register', async (req, res) => {
    const username = req.session.username;
    if (username) {
        res.redirect('/home');
    } else {
        const { username, contact, email, accountType, password, confirmPassword } = req.body;
        if (username) {
            let check = await db.get(`users.${username}`);
            if (check) {
                res.redirect('/register?error=1');
            } else if (password !== confirmPassword) {
                res.redirect('/register?error=2');
            } else if (password.length < 6) {
                res.redirect('/register?error=3');
            } else {
                await db.set(`users.${username}`, { contact, email, accountType, password });
                res.redirect('/login?error=0');
            }
        } else {
            res.redirect('/register?error=0');
        }
    }
});

app.get('/stores', async (req, res) => {
    let { sortBy, categories } = req.query;
    if (!sortBy) sortBy = 1
    else sortBy = parseInt(sortBy); // 1, 2, 3 (featured, price low to high, price high to low)
    categories = categories ? categories.split(',') : [];
    let stores = await db.get('stores') || [];
    let toSend = [];
    if (categories.length > 0) {
        for (let store of stores) {
            for (let category of categories) {
                if (store.products[category].length > 0) {
                    toSend.push(store);
                    break;
                }
            }
        }
    } else {
        toSend = stores;
    }
    if (sortBy === 2) {
        if (categories.length > 0) {
            toSend = toSend.sort((a, b) => a.products[categories[0]][0].price - b.products[categories[0]][0].price);
        } else {
            toSend = toSend.sort((a, b) => {
                let aPrice = a.products.high[0].price || a.products.mid[0].price || a.products.low[0].price;
                let bPrice = b.products.high[0].price || b.products.mid[0].price || b.products.low[0].price;
                return aPrice - bPrice;
            });
        }
    } else if (sortBy === 3) {
        if (categories.length > 0) {
            toSend = toSend.sort((a, b) => b.products[categories[0]][0].price - a.products[categories[0]][0].price);
        } else {
            toSend = toSend.sort((a, b) => {
                let aPrice = a.products.high[0].price || a.products.mid[0].price || a.products.low[0].price;
                let bPrice = b.products.high[0].price || b.products.mid[0].price || b.products.low[0].price;
                return bPrice - aPrice;
            });
        }
    } else {
        toSend = toSend.sort(() => 0.7 - 0.5);
    }
    res.render('stores', { stores: toSend, req: req, sortBy, categories });
});

app.get('/profile', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let user = await db.get(`users.${username}`);
        let orders = await db.get(`orders.${username}`) || [];
        res.render('profile', { user, req: req, orders });
    } else {
        res.redirect('/login');
    }
});

app.post('/editProfile', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let { contact, email, accountType, password } = req.body;
        let user = await db.get(`users.${username}`);
        if (user) {
            password = password || user.password;
            await db.set(`users.${username}`, { contact, email, accountType, password });
        }
        res.redirect('/profile');
    } else {
        res.status(403).send('Forbidden');
    }
});

app.get('/manage', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let user = await db.get(`users.${username}`);
        let success = req.query.success || false;
        let error = req.query.error || false;
        let msg = false;
        let menu = req.query.menu || '1';
        if (success) {
            msg = 'Operation successful';
        } else if (error) {
            switch (error) {
                case '1':
                    msg = 'Store with that ID already exists';
                    break;
                case '2':
                    msg = 'Product with that ID already exists';
                    break;
                case '3':
                    msg = 'Profile with that Username already exists';
                    break;
                case '4':
                    msg = 'Store not found';
                    break;
                case '5':
                    msg = 'Product not found';
                    break;
                case '6':
                    msg = 'Profile not found';
                    break;
                default:
                    break;
            }
        }
        if (user.accountType === 'admin') {
            let stores = await db.get('stores') || [];
            res.render('manage', { stores, req: req, msg, menu });
        } else if (user.accountType === 'seller') {
            let stores = await db.get('stores') || [];
            stores = stores.filter(store => store.seller === username);
            res.render('manage', { stores, req: req, msg, menu });
        } else {
            res.status(403).send('Forbidden');
        }
    } else {
        res.redirect('/login');
    }
});

app.post('/addStore', async (req, res) => {
    let username = req.session.username;
    if (username) {
        if (!req.session.admin && !req.session.seller) {
            res.status(403).send('Forbidden');
        }
        let { name, description, id, url } = req.body;
        let stores = await db.get('stores') || [];
        let check = stores.find(s => s.id === id);
        if (check) {
            return res.redirect('/manage?error=1');
        }
        let email = req.session.email;
        let store = { name, seller: username, description, email, id, url, products: { high: [], mid: [], low: [] } };
        await db.push('stores', store);
        res.redirect('/manage?success=1');
    } else {
        res.status(403).send('Forbidden');
    }
});

app.post('/addProduct', async (req, res) => {
    let username = req.session.username;
    if (username) {
        if (!req.session.seller && !req.session.admin) {
            res.status(403).send('Forbidden');
        }
        let { store_id, product_id, product_name, product_description, product_category, product_brand, product_price, product_image } = req.body;
        let stores = await db.get('stores') || [];
        let check = stores.find(s => s.id === store_id);
        if (!check) {
            return res.redirect('/manage?error=1&menu=4');
        }
        let product = { store: store_id, id: product_id, name: product_name, description: product_description, price: product_price, image: product_image, brand: product_brand };
        if (product_category === 'High') {
            let check2 = check.products.high.find(p => p.id === product_id);
            if (check2) {
                return res.redirect('/manage?error=2&menu=4');
            }
            check.products.high.push(product);
        } else if (product_category === 'Medium') {
            let check2 = check.products.mid.find(p => p.id === product_id);
            if (check2) {
                return res.redirect('/manage?error=2&menu=4');
            }
            check.products.mid.push(product);
        } else if (product_category === 'Low') {
            let check2 = check.products.low.find(p => p.id === product_id);
            if (check2) {
                return res.redirect('/manage?error=2&menu=4');
            }
            check.products.low.push(product);
        }
        await db.set('stores', stores);
        res.redirect('/manage?success=1&menu=4');
    } else {
        res.status(403).send('Forbidden');
    }
});

app.post('/removeStore', async (req, res) => {
    let username = req.session.username;
    if (username) {
        if (!req.session.seller && !req.session.admin) {
            res.status(403).send('Forbidden');
        }
        let store = req.body.store_id;
        let stores = await db.get('stores') || [];
        let check = stores.find(s => s.id === store);
        if (check.seller === username || req.session.admin) {
            stores = stores.filter(s => s.id !== store);
            await db.set('stores', stores);
            res.redirect('/manage?success=1&menu=3');
        } else {
            res.redirect('/manage?error=4&menu=3');
        }
    } else {
        res.status(403).send('Forbidden');
    }
});

app.post('/removeProduct', async (req, res) => {
    let username = req.session.username;
    if (username) {
        if (!req.session.seller && !req.session.admin) {
            res.status(403).send('Forbidden');
        }
        let { store, product } = req.body;
        let stores = await db.get('stores') || [];
        let check = stores.find(s => s.id === store);
        if (!check) return res.redirect('/manage?error=4&menu=5')
        if (check.seller === username || req.session.admin) {
            let check2 = check.products.find(p => p.id === product);
            if (!check2) return res.redirect('/manage?error=5&menu=5')
            check.products = check.products.filter(p => p.id !== product);
            await db.set('stores', stores);
            res.redirect('/manage?success=1&menu=5');
        } else {
            res.status(403).send('Forbidden');
        }
    } else {
        res.status(403).send('Forbidden');
    }
});

app.post('/addProfile', async (req, res) => {
    if (!req.session.admin) return res.status(403).send('Forbidden');
    let { username, contact, email, password, accountType } = req.body;
    let check = await db.get(`users.${username}`);
    if (check) {
        return res.redirect('/manage?error=3&menu=6');
    }
    await db.set(`users.${username}`, { contact, accountType, email, password });
    res.redirect('/manage?success=1&menu=6');
});

app.post('/removeProfile', async (req, res) => {
    if (!req.session.admin) return res.status(403).send('Forbidden');
    let username = req.body.username;
    let check = await db.get(`users.${username}`) || false;
    if (check) {
        await db.delete(`users.${username}`);
    } else {
        return res.redirect('/manage?error=6&menu=7');
    }
    res.redirect('/manage?success=1&menu=7');
});

app.get('/product/:id', async (req, res) => {
    let id = req.params.id;
    let error = req.query.error || false;
    let success = req.query.success || false;
    let stores = await db.get('stores') || [];
    await new Promise((resolve, reject) => {
        for (let store of stores) {
            let product = store.products.high.find(p => p.id === id) || store.products.mid.find(p => p.id === id) || store.products.low.find(p => p.id === id);
            if (product) {
                res.render('product', { product, store, req: req, error, success });
                resolve();
                break;
            } else {
                continue;
            }
        }
        res.status(404).send('Not found');
    });
});

app.get('/cart', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let cart = await db.get(`cart.${username}`) || []
        let total = 0;
        cart.forEach(element => {
            total += element.price * element.quantity;
        });
        let error = req.query.error || false;
        if (error) {
            switch (error) {
                case "2":
                    error = "No items to checkout"
                    break;
                default:
                    error = false;
                    break;
            }
        }
        res.render('cart', { products: cart, req: req, total, error });
    } else {
        res.redirect('/login');
    }
});

app.post('/cart', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let { store, productId, buyNow, price, image, name } = req.body;
        let cart = await db.get(`cart.${username}`) || [];
        // Check if product is from the same store
        let check = cart[0] ? cart[0].store === store : true;
        if (!check) {
            return res.redirect(`/product/${productId}?error=1`);
        } else {
            // Check if product is already in cart
            let check2 = cart.find(p => p.productId === productId);
            let quantity = 1;
            if (check2) {
                quantity = check2.quantity + 1;
                cart = cart.filter(p => p.productId !== productId);
            }
            let product = { productId, quantity, price, image, store, name };
            cart.push(product);
            await db.set(`cart.${username}`, cart);
            if (buyNow == 'true') {
                res.redirect('/checkout');
            } else {
                res.redirect(`/product/${productId}?success=1`);
            }
        }
    } else {
        res.redirect('/login');
    }
});

app.get('/removeCart', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let productId = req.query.id;
        let cart = await db.get(`cart.${username}`) || [];
        let product = cart.find(p => p.productId === productId);
        if (product) {
            let quantity = product.quantity;
            if (quantity > 1) {
                product.quantity -= 1;
            } else {
                cart = cart.filter(p => p.productId !== productId);
            }
            await db.set(`cart.${username}`, cart);
            res.redirect('/cart');
        } else {
            res.redirect('/cart');
        }
    } else {
        res.redirect('/login');
    }
})

app.get('/addCart', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let productId = req.query.id;
        let cart = await db.get(`cart.${username}`) || [];
        let product = cart.find(p => p.productId === productId);
        if (product) {
            product.quantity = product.quantity + 1;
        }
        await db.set(`cart.${username}`, cart);
        res.redirect('/cart');
    } else {
        res.redirect('/login');
    }
});

app.get('/checkout', async (req, res) => {
    let username = req.session.username;
    if (username) {
        let cart = await db.get(`cart.${username}`) || [];
        if (cart.length < 1) return res.redirect('/cart?error=2')
        let total = 0;
        cart.forEach(element => {
            total += element.price * element.quantity;
        });
        res.render('checkout', { products: cart, req: req, total, order: false, error: false });
    } else {
        res.redirect('/login');
    }
});

app.post('/checkout', async (req, res) => {
    const username = req.session.username;
    if (!username) return res.sendStatus(403).send("Forbidden")
    let cart = await db.get(`cart.${username}`) || [];
    if (!cart) return res.redirect("/cart?error=1")
    let { address, payment } = req.body;
    let total = 0;
    let pods = []
    if (cart.length < 1) return res.redirect('/cart?error=2');
    let store = cart[0].store || false;
    if (!store) return res.redirect('/cart?error=2')
    cart.forEach(element => {
        total += element.price * element.quantity;
        pods.push(element.name);
    });
    let date = new Date();
    // Format date into human readable form
    date = date.toISOString().split('T')[0];
    let order = { address, payment, store, total, products: pods, date: date };
    let orders = await db.get(`orders.${username}`) || [];
    orders.push(order);
    await db.set(`orders.${username}`, orders);
    await db.delete(`cart.${username}`);
    return res.render('checkout', { products: cart, req: req, total, order });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    // Clear cookie
    res.clearCookie('username');
    res.redirect('/home');
})

app.listen(port, () => {
    console.log(`Server running on port http://localhost:${port}`);
});