const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const port = 8080;

const LokiStore = require('connect-loki')(session);
app.use(cors({
    origin : true,
    credentials : true
}));

app.use(express.json());
app.use(bodyParser.json());
app.use(session({
    key: 'is_logined',
    store: new LokiStore(),
    secret: '@#$mydelivermon$#@', 
    resave: false,      
    saveUninitialized: true,     //uninitialized session 저장
}));

const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host: 'localhost',
    user: 'root',
    password: '12345',
    database: 'delivermon',
    connectionLimit: 10
});

const kakao = {
    clientID: '50d82401af69d2eb95ac06692fa01a4d',
    redirectUri: 'http://localhost:3000/auth/kakao/callback',
    tokenApiUrl: "https://kauth.kakao.com/oauth/token",
    grant_type: "authorization_code"
}
const naver = {
    clientID: 'ybCPyS_tXuxjTvDk16Ne',
    redirectUri: 'http://localhost:3000/auth/naver/callback',
    client_secret: 'giSyerOcIL',
    tokenApiUrl: 'https://nid.naver.com/oauth2.0/token',
    grant_type: 'authorization_code'
}

var usercode, storecode, ridercode, codevalues;

async function signUpDB(id, pw, name, category, phone, address){    //category에 따라 user/store/rider 테이블에 회원가입 정보 넣기
    let conn;
    try{
        conn = await pool.getConnection();     //커넥션 풀에서 커넥션 가져오기
        console.log('signup conn');

        if(category === 'user'){
            const sqluser = await conn.query("INSERT INTO user (ID, PW, USER_NAME, CATEGORY, PHONE, ADDRESS) VALUE(?, ?, ?, ?, ?, ?)", [id, pw, name, category, phone, address]);
        } else if(category === 'store'){
            const sqlstore = await conn.query("INSERT INTO store (ID, PW, STORE_NAME, PHONE, LOCATION) VALUE(?, ?, ?, ?, ?)", [id, pw, name, phone, address]);
        } else if(category === 'rider'){
            const sqlrider = await conn.query("INSERT INTO rider(ID, PW, RIDER_NAME, PHONE, ADDRESS) VALUE(?, ?, ?, ?, ?)", [id, pw, name, phone, address]);
        }
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();       // 커넥션 풀에 커넥션 반환
    }
}

app.post('/signup', (req, res) => {     //signUpDB를 통해 회원가입하기
    (async () => {
        const {
            category,
            id,
            pw,
            name,
            phone,
            address
        } = req.body;

        try {    
            const sqlResult = signUpDB(id, pw, name, category, phone, address);
            res.send({msg: '회원가입이 완료되었습니다.'});
        }catch (err) {
            console.log(err);
            res.status(500).send(err);
        }
    })()
})

async function signInDB(id, pw, category){    //user, store, rider 테이블에 저장된 회원인지 확인
    let conn;
    let rows;
    try{
        conn = await pool.getConnection();     //커넥션 풀에서 커넥션 가져오기
        console.log('signIn conn');

        if(category === 'user'){
            rows = await conn.query("SELECT * FROM user WHERE id = ? and pw = ?", [id, pw]);
            usercode = await conn.query("SELECT USER_CODE FROM user WHERE id = ? and pw = ?" , [id, pw]);
        }else if(category === 'store'){
            rows = await conn.query("SELECT * FROM store WHERE id = ? and pw = ?", [id, pw]);  
            storecode = await conn.query("SELECT STORE_CODE FROM store WHERE id = ? and pw = ?", [id, pw]);
            codevalues = Object.values(storecode[0]);
        }else if(category === 'rider'){
            rows = await conn.query("SELECT * FROM rider WHERE id = ? and pw = ?", [id, pw]);
            ridercode = await conn.query("SELECT RIDER_CODE FROM rider WHERE id = ? and pw = ?", [id, pw]);
        }

        if(rows[0] === undefined) {         //저장된 id,pw가 없으면 로그인 실패
            console.log('no');
            return 'no';
        }
        else {
            //console.log(rows[0]);
            return rows[0];
        }
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();       // 커넥션 풀에 커넥션 반환
    }
}

app.post('/login', (req, res) => {      //로그인 요청 받으면 db 해당 카테고리 테이블에 회원정보 있는지 확인하고 client로 결과 보내기
    let id = req.body.id;
    let pw = req.body.pw;
    let category = req.body.category;
    let remember = req.body.remember;

    (async() => {
        let check = await signInDB(id, pw, category);
        if(remember === true){
            req.session.is_logined = true;
        }
        res.send(JSON.stringify(check));
    })()
    
})

async function storeList(){     //store 테이블에서 모든 STORE_NAME 가져오기
    let conn;
    try{
        conn = await pool.getConnection();
        const sqllist = await conn.query(`SELECT STORE_CODE AS "key", STORE_NAME FROM store`);
        console.log(sqllist);
        return sqllist;
    } catch (err){
        throw err;
    } finally {
        if(conn) conn.release();
    }
}

app.post('/callstore', (req, res) => {
    (async() => {
        try{
            const sqlcallstore = await storeList();
            res.send(JSON.stringify(sqlcallstore));
        } catch(err) {
            console.log(err);
        }
    })()
})

async function menuSelect(codevalues){      //menu테이블에서 가게에 맞는 FOOD_NAME, PRICE 가져오기
    let conn;
    try{
        conn = await pool.getConnection();
        const sqlselect = await conn.query(`SELECT FOOD_CODE AS "key", FOOD_NAME, PRICE FROM menu WHERE STORE_CODE = ?`, codevalues);
        //console.log(sqlselect);
        return sqlselect;
    }
    catch (err){
        throw err;
    } finally {
        if(conn) conn.release();
    }
}

app.post('/callmenu', (req, res) => {
    let codevalues = req.body.storecode;
    (async () => {
        try{
            const sqlcallmenu = await menuSelect(codevalues);
            res.send(JSON.stringify(sqlcallmenu));
        }catch(err){
            console.log(err);
        }}
    )()
})

async function menuInsert(storecode, name, price){      //menu 테이블에 메뉴 추가하기
    let conn;
    try{
        conn = await pool.getConnection();     //커넥션 풀에서 커넥션 가져오기
        console.log('conn');

        const sqlmenu = await conn.query("INSERT INTO menu (STORE_CODE, FOOD_NAME, PRICE) value(?, ?, ?)", [storecode, name, price]);

    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();       // 커넥션 풀에 커넥션 반환
    }
}

app.post('/menuinsert', (req, res) => {
    (async() =>{
        let menustorecode = req.body.menuTemplete.storecode;
        let foodname = req.body.menuTemplete.foodname;
        let price = req.body.menuTemplete.price;
        
        try{
            const sqlResult = await menuInsert(menustorecode,foodname, price);
            res.send({msg: '메뉴가 등록되었습니다.'});

        }catch (err) {
            console.log(err);
        }
    })()
})

async function OrderInsert(){      //order_delivery 테이블에 주문 추가하기
    let conn;
    try{
        conn = await pool.getConnection();     //커넥션 풀에서 커넥션 가져오기
        console.log('conn');

        const sqlorder = await conn.query("INSERT INTO order_delivery () value()", []);

    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();       // 커넥션 풀에 커넥션 반환
    }
}

app.post('/orderinsert', (req, res) => {
    (async() => {
        let address = req.body.userOrderTemplete.address;
        let phone = req.body.userOrderTemplete.phone;
        let payment = req.body.userOrderTemplete.payment;
        let requests = req.body.userOrderTemplete.requests;
        
        try{
            const orderResult = await OrderInsert(address, phone, payment, requests);
        }catch (err){
            console.log(err);
        }
    })
})

async function menuUpdate(storecode, name, price){
    let conn;
    try{
        conn = await pool.getConnection();     //커넥션 풀에서 커넥션 가져오기
        console.log('update conn');

        const sqlmenu = await conn.query("ALTER TABLE menu (STORE_CODE, FOOD_NAME, PRICE) value(?, ?, ?)", [storecode, name, price]);
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();       // 커넥션 풀에 커넥션 반환
    }

}

app.post('/menuupdate', (req, res) => {
    (async() => {
        let menustorecode = codevalues;
        let foodname = req.body.foodname;
        let price = req.body.price;
        
        try{
            const sqlupdatemenu = await menuUpdate(menustorecode,foodname, price);
            res.send({msg: '메뉴가 수정되었습니다.'});
        }catch (err){
            console.log(err);
        }
    })()
})

async function menuDelete(code){        //menu 테이블에서 메뉴 삭제하기
    let conn;
    try{
        conn = await pool.getConnection();     //커넥션 풀에서 커넥션 가져오기
        console.log('delete conn');

        const sqlmenu = await conn.query("DELETE FROM menu WHERE FOOD_CODE = ?", [code]);
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();       // 커넥션 풀에 커넥션 반환
    }

}

app.post('/menudelete', (req, res) => {
    (async() => {
        let foodcode = req.body.foodcode;
        console.log('foodcode',foodcode)
        try{
            const sqldeletemenu = await menuDelete(foodcode);
            res.send({msg: '메뉴가 삭제되었습니다.'});
        }catch (err){
            console.log(err);
        }
    })()
})


app.get('/logincheck', function (req, res){
    console.log('check')
    if(req.session.is_logined != true){
        console.log("로그인 안된 경우");
    }
    else{
        res.send(req.session.is_logined);
        console.log("로그인 된 경우");
    }
})

app.post('/logout', function (req, res){
    console.log('logout');
    req.session.destroy();
    const html = `<html>
                            <script>
                                function gotoMain() {
                                    window.location = 'http://localhost:3000'
                                }
                                gotoMain();
                            </script>
                        </html>`
    res.send(html);
})

app.get('/auth/kakao/callback', function (req, res) {     //인가코드를 카카오 서버로 보내고 유효 토큰을 받는다.
    let code = req.query.code;
    try{
        axios.post(     //토큰 요청
            `${kakao.tokenApiUrl}?grant_type=${kakao.grant_type}&client_id=${kakao.clientID}&redirect_uri=${kakao.redirectUri}&code=${code}`
            , {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
            }).then((result)=>{     //토큰 출력
                console.log('token');
                console.log(result.data['access_token']);

                //토큰을 통해서 유저 정보 받아오기
                axios.get('https://kapi.kakao.com/v2/user/me', {
                    headers: {
                        Authorization: `Bearer ${result.data.access_token}`
                    }
                }).then((response) => { 
                console.log('유저 정보');
                console.log(response.data);
                req.session.is_logined = true;

                const html = `<html>
                            <script>
                                function gotoMain() {
                                    window.location = 'http://localhost:3000'
                                }
                                gotoMain();
                            </script>
                        </html>`
                res.send(html);

                }).catch(error => {
                    console.log(error);
                })
                
            }).catch(e=> {
                console.log(e);
            })
        }catch(e){
            console.log(e);
            
        }
})


app.get('/auth/naver/callback', function (req, res) {     //인가코드를 네이버 서버로 보내고 유효 토큰을 받는다.
    let code = req.query.code;
    let state = req.query.state;
    try{
        axios.post(     //토큰 요청
            `${naver.tokenApiUrl}?grant_type=${naver.grant_type}&client_id=${naver.clientID}&client_secret=${naver.client_secret}&redirect_uri=${naver.redirectUri}&code=${code}&state=${state}`
            , {
            headers: {
                'Content-type': 'text/html;charset=utf-8'
            }
        }).then((result)=>{     //토큰
            console.log('token');
            console.log(result.data['access_token']);

            //토큰을 통해서 유저 정보 받아오기
            axios.get('https://openapi.naver.com/v1/nid/me', {
                headers: {
                    Authorization: `Bearer ${result.data.access_token}`
                }
            }).then((response) => { 
            console.log('유저 정보');
            console.log(response.data);
            req.session.is_logined = true;

            const html = `<html>
                            <script>
                                function gotoMain() {
                                    window.location = 'http://localhost:3000'
                                }
                                gotoMain();
                            </script>
                        </html>`
            res.send(html);

            }).catch(error => {
                console.log(error);
            })
            
        }).catch(e=> {
            console.log(e);
        })
    }catch(e){
        console.log(e);
        
    }
})



app.listen(port, () => console.log(`Server is running on port ${port}...`));
