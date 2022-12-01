const express = require('express');
const session = require('express-session');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const port = 8080;

app.use(cors({
    origin : true,
    credentials : true
}));

app.use(bodyParser.json());

const mysql = require('mysql');
const conn = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '12345',
    database: 'delivermon'
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

function signUpDB(id, pw, name){
    try{
        let connection = mysql.createConnection(conn);      //DB커넥션 생성
        connection.connect();       //DB접속

        let sql = connect.query("INSERT INTO user (ID,PW,USER_NAME) VALUES(?, ?, ?)", [id, pw, name]);
        console.log("insert");

    } catch (err) {
        console.log(err);
    } finally {
        
    }
}

app.post('/signup', (req, res) => {
    try {
        let connection = mysql.createConnection(conn);      //DB커넥션 생성
        connection.connect();       //DB접속
        const sqlResult = signUpDB(id, pw, name)
    }catch (err) {
        console.log(err)
        res.status(500).send(err)
    }
})

app.post('/login', (req, res) => {

})



app.get('/logincheck', function (req, res){
    console.log('check')

    if(req.session.is_logined != true){
        console.log("로그인 안된 경우");
    }
    else{
        res.send(req.session.is_logined);
        console.log("로그인 된 경우")
    }
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
