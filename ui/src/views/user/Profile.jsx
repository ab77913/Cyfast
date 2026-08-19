import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Card, Button, Table } from 'react-bootstrap';
import user2 from '../../assets/images/user/avatar-1.jpg';
import { getProjects, getMyProfile } from 'utils/apiServices';
import { getStatusBadge } from 'data/listData';

const Profile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [activeProfileTab, setActiveProfileTab] = useState('profile');
  const [isPersonalEdit, setIsPersonalEdit] = useState(false);
  const [isContactEdit, setIsContactEdit] = useState(false);
  const [isOtherEdit, setIsOtherEdit] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const profileTabClass = 'nav-link text-reset';
  const profileTabActiveClass = 'nav-link text-reset active';

  const profilePanClass = 'tab-pane fade';
  const profilePanActiveClass = 'tab-pane fade show active';

  const fetchMyProfile = async () => {
    const response = await getMyProfile();
    if (response && response.status === 200) {
      setUserProfile(response.data);
    }
  };

  useEffect(() => {
    fetchMyProfile();
  }, []);

  // Fetch projects when My Projects tab is active
  useEffect(() => {
    if (activeProfileTab === 'contact') {
      setLoadingProjects(true);
      getProjects()
        .then((response) => {
          setProjects(response.data.data || []);
          setLoadingProjects(false);
        })
        .catch((error) => {
          console.error('Failed to fetch projects:', error);
          setLoadingProjects(false);
        });
    }
  }, [activeProfileTab]);

  return (
    <React.Fragment>
      <Card className="user-profile user-card mb-4 p-0">
        <Card.Body className="py-0">
          <div className="user-about-block m-0">
            <Row>
              <Col md={4} className="d-flex align-items-center" style={{ marginTop: 45, gap: '10px' }}>
                <div
                  style={{
                    backgroundColor: '#007bff',
                    borderRadius: '50%',
                    padding: 5,
                    display: 'inline-block'
                  }}
                >
                  <img src={user2} alt="User Avatar" className="rounded-circle" style={{ width: 60, height: 60, display: 'block' }} />
                </div>

                <div>
                  <h5 className="mb-1 text-start">{userProfile ? userProfile.first_name : 'Loading...'}</h5>
                  <p className="mb-2 text-muted" style={{ marginBottom: 0 }}>
                    {userProfile ? userProfile.roles[0].name : 'Loading...'}
                  </p>
                </div>
              </Col>

              <Col md={8} className="mt-md-4">
                <ul className="nav nav-tabs profile-tabs nav-fill" id="myTab" role="tablist">
                  <li className="nav-item">
                    <Link
                      to="#"
                      className={activeProfileTab === 'profile' ? profileTabActiveClass : profileTabClass}
                      onClick={() => {
                        setActiveProfileTab('profile');
                      }}
                      id="profile-tab"
                    >
                      <i className="feather icon-user me-2 px-2" />
                      Profile
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      to="#"
                      className={activeProfileTab === 'contact' ? profileTabActiveClass : profileTabClass}
                      onClick={() => {
                        setActiveProfileTab('contact');
                      }}
                      id="contact-tab"
                    >
                      <i className="feather icon-layers me-2 px-2" />
                      Projects
                    </Link>
                  </li>
                </ul>
              </Col>
            </Row>
          </div>
        </Card.Body>
      </Card>
      <Row>
        <Col md={12}>
          <div className="tab-content">
            <div className={activeProfileTab === 'profile' ? profilePanActiveClass : profilePanClass} id="profile">
              <Row>
                <Col md={4} className="d-flex">
                  <Card className="w-100 h-100">
                    <Card.Body className="d-flex align-items-center justify-content-between border-bottom">
                      <h5 className="mb-0">Personal details</h5>
                      <Button
                        variant="primary"
                        size="sm"
                        className="rounded m-0 float-end"
                        onClick={() => setIsPersonalEdit(!isPersonalEdit)}
                      >
                        <i className={isPersonalEdit ? 'feather icon-x' : 'feather icon-edit'} />
                      </Button>
                    </Card.Body>
                    <Card.Body className={isPersonalEdit ? 'border-top pro-det-edit collapse' : 'border-top pro-det-edit collapse show'}>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Full Name</label>
                        <Col sm={9}>{userProfile ? userProfile.first_name + ' ' + userProfile.last_name : ''}</Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Gender</label>
                        <Col sm={9}>{userProfile ? userProfile.gender : ''}</Col>
                      </Row>

                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Location</label>
                        <Col sm={9}>{userProfile ? userProfile.address : ''}</Col>
                      </Row>
                    </Card.Body>
                    <Card.Body className={isPersonalEdit ? 'border-top pro-det-edit collapse show' : 'border-top pro-det-edit collapse'}>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">First Name</label>
                        <Col sm={9}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="First Name"
                            defaultValue={userProfile ? userProfile.first_name : ''}
                          />
                        </Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Last Name</label>
                        <Col sm={9}>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Last Name"
                            defaultValue={userProfile ? userProfile.last_name : ''}
                          />
                        </Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Gender</label>
                        <Col sm={9}>
                          <div className="custom-control custom-radio custom-control-inline">
                            <input
                              type="radio"
                              id="customRadioInline1"
                              name="customRadioInline1"
                              className="custom-control-input"
                              defaultValue="male"
                              defaultChecked
                            />
                            <label className="custom-control-label mx-2" htmlFor="customRadioInline1">
                              Male
                            </label>
                          </div>
                          <div className="custom-control custom-radio custom-control-inline">
                            <input
                              type="radio"
                              id="customRadioInline2"
                              name="customRadioInline1"
                              className="custom-control-input"
                              defaultValue="female"
                            />
                            <label className="custom-control-label mx-2" htmlFor="customRadioInline2">
                              Female
                            </label>
                          </div>
                        </Col>
                      </Row>

                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Location</label>
                        <Col sm={9}>
                          <textarea
                            className="form-control"
                            defaultValue="4289 Calvin Street,  Baltimore, near MD Tower Maryland, Maryland (21201)"
                          />
                        </Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label" />
                        <Col sm={9}>
                          <Button type="submit" variant="primary" onClick={() => setIsPersonalEdit(!isPersonalEdit)}>
                            Save
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={4} className="d-flex">
                  <Card className="w-100 h-100">
                    <Card.Body className="d-flex align-items-center justify-content-between border-bottom">
                      <h5 className="mb-0">Contact Information</h5>
                      <Button
                        variant="primary"
                        size="sm"
                        className="rounded m-0 float-end"
                        onClick={() => setIsContactEdit(!isContactEdit)}
                      >
                        <i className={isContactEdit ? 'feather icon-x' : 'feather icon-edit'} />
                      </Button>
                    </Card.Body>
                    <Card.Body className={isContactEdit ? 'border-top pro-det-edit collapse' : 'border-top pro-det-edit collapse show'}>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Mobile Number</label>
                        <Col sm={9}>+1 9999-999-999</Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Email Address</label>
                        <Col sm={9}>{userProfile ? userProfile.email : ''}</Col>
                      </Row>
                    </Card.Body>
                    <Card.Body className={isContactEdit ? 'border-top pro-det-edit collapse show' : 'border-top pro-det-edit collapse'}>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Mobile Number</label>
                        <Col sm={9}>
                          <input type="text" className="form-control" placeholder="Full Name" defaultValue="+1 9999-999-999" />
                        </Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Email Address</label>
                        <Col sm={9}>
                          <input type="text" className="form-control" placeholder="Ema" defaultValue="demo@domain.com" />
                        </Col>
                      </Row>

                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label" />
                        <Col sm={9}>
                          <Button type="submit" variant="primary" onClick={() => setIsContactEdit(!isContactEdit)}>
                            Save
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4} className="d-flex">
                  <Card className="w-100 h-100">
                    <Card.Body className="d-flex align-items-center justify-content-between border-bottom">
                      <h5 className="mb-0">Other Information</h5>
                      <Button variant="primary" size="sm" className="rounded m-0 float-end" onClick={() => setIsOtherEdit(!isOtherEdit)}>
                        <i className={isOtherEdit ? 'feather icon-x' : 'feather icon-edit'} />
                      </Button>
                    </Card.Body>
                    <Card.Body className={isOtherEdit ? 'border-top pro-det-edit collapse' : 'border-top pro-det-edit collapse show'}>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Occupation</label>
                        <Col sm={9}>Designer</Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Skills</label>
                        <Col sm={9}>C#, Javascript, Scss</Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label pt-0 fw-bolder">Jobs</label>
                        <Col sm={9}>Test Engineer</Col>
                      </Row>
                    </Card.Body>
                    <Card.Body className={isOtherEdit ? 'border-top pro-det-edit collapse show' : 'border-top pro-det-edit collapse'}>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Occupation</label>
                        <Col sm={9}>
                          <input type="text" className="form-control" placeholder="Full Name" defaultValue="Designer" />
                        </Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Skills</label>
                        <Col sm={9}>
                          <input type="text" className="form-control" placeholder="Skill" defaultValue="C#, Javascript, Scss" />
                        </Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label fw-bolder">Jobs</label>
                        <Col sm={9}>
                          <input type="text" className="form-control" placeholder="Skill" defaultValue="Codedtehemes" />
                        </Col>
                      </Row>
                      <Row className="form-group pb-3">
                        <label className="col-sm-3 col-form-label" />
                        <Col sm={9}>
                          <Button type="submit" variant="primary" onClick={() => setIsOtherEdit(!isOtherEdit)}>
                            Save
                          </Button>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </div>
            <div className={activeProfileTab === 'contact' ? 'tab-pane fade show active' : 'tab-pane fade'} id="contact">
              <Card>
                {/* <Card.Header>
                  <h5 className="font-weight-normal">Projects</h5>
                </Card.Header> */}
                <Card.Body>
                  {loadingProjects ? (
                    <p>Loading projects...</p>
                  ) : projects.length === 0 ? (
                    <p>No projects found.</p>
                  ) : (
                    <Table responsive hover className="align-middle mb-0 mt-2">
                      <thead className="thead-light">
                        <tr>
                          <th>Project Name</th>
                          <th>Project Type</th>
                          <th>Description</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map((project) => (
                          <tr key={project.project_id}>
                            <td>{project.name}</td>
                            <td>{project.type}</td>
                            <td className="text-wrap">{project.description}</td>
                            <td>{getStatusBadge(project.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card.Body>
              </Card>
            </div>
          </div>
        </Col>
      </Row>
    </React.Fragment>
  );
};

export default Profile;
